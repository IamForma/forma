'use strict';

/**
 * Строки расхода в карточке: заходы узлов, сервисы, неисправные записи, дата закрытия.
 * Формат зафиксирован в AGENTS.md §3:
 *   `Узел`, ГГГГ-ММ-ДД: заход, N токенов (R кэш-чтение), T с — <что сделано>.
 *   `Узел`, ГГГГ-ММ-ДД: заход, N токенов (R кэш-чтение), T с, $X.XXXXXX (провайдер/модель) — ...
 * Денежный сегмент опционален — только внешняя модель, не Agent tool (подписка).
 *
 * Кэш-чтение и секунды разбираются как необязательные: старые строки без них читаются как раньше
 * и отличаются от новых не нулём, а признаком «не записано» (`null`).
 * «токен / токена / токенов» — числительное согласуется, разборщик обязан это знать.
 * Число ОБЯЗАНО начинаться с цифры: класс `[\d\s\u00a0]+` совпадал и с одними пробелами,
 * поэтому строка «заход, токенов не записано» разбиралась как исправная запись с NaN
 * и уносила в NaN весь счёт. `\d[\d\s\u00a0]*` требует хотя бы одну цифру, а «4 787 590»
 * разбирает ровно как раньше: пробелы стоят внутри числа, не в его начале.
 * Канон ключевой части — английский; русские строки приводятся `toEnglish()` до разбора.
 */

const { toEnglish, SPEND_SOURCE, ID_UNKNOWN_RE, CLAIM_RE, sessionWindowEnd } = require('../spend-line.cjs');

const ATTEMPT_RE = new RegExp(SPEND_SOURCE, 'g');

const num = (s) => parseInt(String(s).replace(/[\s\u00a0]/g, ''), 10);

/**
 * Вторая защита, независимая от первой. Строгая цифра в разборе закрывает известный случай;
 * эта проверка закрывает неизвестные: нечисло не входит в сумму НИКОГДА. NaN заразен: одно значение
 * уносит любой итог, куда попало, и отладить это по отчёту нельзя. Строка с нечислом уходит наверх
 * как неисправная и называется адресом карточки (`data.economy.malformed`).
 * Возвращает готовые числа или `null` — «это не запись расхода, считать её нельзя».
 */
function attemptNumbers(m) {
  // `unknown tokens` (ECONOMY.md, «The `unknown` marker») — заход есть, числа нет: null, не ноль и не выпадение.
  const tokensUnknown = m[3] === 'unknown';
  const tokens = tokensUnknown ? null : num(m[3]);
  if (!tokensUnknown && !Number.isFinite(tokens)) return null;
  const cacheRead = m[4] != null ? num(m[4]) : null;
  if (cacheRead != null && !Number.isFinite(cacheRead)) return null;
  const seconds = m[5] != null && m[5] !== 'unknown' ? num(m[5]) : null;
  if (seconds != null && !Number.isFinite(seconds)) return null;
  return { tokens, tokensUnknown, cacheRead, seconds, secondsUnknown: m[5] === 'unknown' };
}

// Внешний сервис считает в своей единице: у Magnific — кредиты, у другого могут быть запросы или минуты.
// Разбор имён сервисов НЕ знает: берёт любое «N <единица> (<сервис>/<операция>)» и группирует по паре
// сервис+единица. Иначе каждый новый сервис требовал бы правки кода, а до неё его расход молча не считался бы.
// Доллары остаются отдельным сегментом: у них своя, давняя запись `$X (провайдер/модель)`.
const SERVICE_RE = /(\d[\d\s\u00a0]*)\s*([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё.]*)\s*\(([^)/]+)\/([^)]+)\)/g;

function parseServices(tail) {
  const out = [];
  if (!tail) return out;
  SERVICE_RE.lastIndex = 0;
  let m;
  while ((m = SERVICE_RE.exec(tail)) !== null) {
    // Сервис от времени по названию единицы не отличить: «12 минут (aura/build)» — законная единица
    // сервиса, а не время захода. Отличает форма: у сервиса есть скобка с косой чертой.
    out.push({ amount: num(m[1]), unit: m[2], service: m[3].trim(), operation: m[4].trim() });
  }
  return out;
}

// Расход сервиса не всегда рождается внутри захода узла: генерацию может запустить человек напрямую,
// а токенов у такого события нет вовсе. Поэтому — отдельная форма строки, не подделка под заход:
//   `- Сервис, ГГГГ-ММ-ДД: 1160 кредитов (magnific/tripo-image-to-3d-high) — что сделано.`
const SERVICE_LINE_RE = /^-\s*(?:Service|Сервис),\s*(\d{4}-\d{2}-\d{2}):([^\n—]*)/gm;

function parseServiceLines(raw) {
  const out = [];
  SERVICE_LINE_RE.lastIndex = 0;
  let m;
  while ((m = SERVICE_LINE_RE.exec(raw)) !== null) {
    for (const sv of parseServices(m[2])) out.push({ date: m[1], node: null, ...sv });
  }
  return out;
}

/**
 * Строки со словом «заход», которые НЕ разобрались как запись расхода. Не то же, что законный ноль:
 * `Intent` в общей сессии пишет «заход, 0 токенов, 0 с» — там числа ЕСТЬ и они верны. Здесь расход был,
 * а числа нет вовсе — такие строки молча выпадали из счёта, пока наружу их не показывал никто.
 * Ищется ФОРМА записи (дата, двоеточие, «заход,»), а не слово: в прозе оно встречается сплошь.
 */
function parseMalformedAttempts(raw) {
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = toEnglish(line.trim());
    if (!/^-\s/.test(t) || !CLAIM_RE.test(t)) continue;
    ATTEMPT_RE.lastIndex = 0;
    const m = ATTEMPT_RE.exec(t);
    // Совпала с формой — ещё не значит исправна: числа могут оказаться нечислом. Тогда строка НАЗЫВАЕТСЯ.
    if (m && attemptNumbers(m)) continue;
    out.push(t.replace(/^-\s*/, '').slice(0, 180));
  }
  return out;
}

// Дата закрытия карточки. Во фронтматтере её нет и не будет (§6: файлы пишет расширение доски и сохранит ли оно
// незнакомый ключ — не установлено). Источник — строка истории с постоянным началом `закрыто —`, которую пишет
// `Intent` при закрытии. Нет строки — null, и отображение берёт дату последнего захода, подписав её приблизительной.
const CLOSED_RE = /^-\s*`([^`]+)`,\s*(\d{4}-\d{2}-\d{2}):\s*закрыто\s*—/m;

function parseClosedDate(raw) {
  const m = CLOSED_RE.exec(raw);
  return m ? m[2] : null;
}

// Запись расхода — ПУНКТ списка `## История`, а не всякое место, где форма встретилась: разбор по всему
// телу файла засчитывал бы дословную цитату учётной строки в прозе как ещё один заход. То же правило —
// в `parseMalformedAttempts`, `tally.cjs`, `sync-engines.cjs`. Группы совпадают с ATTEMPT_RE.
const ATTEMPT_LINE_RE = new RegExp('^-\\s*' + ATTEMPT_RE.source);

/** Запись захода из совпадения `m` и строки `line`; нечисло — `null` (его называет `parseMalformedAttempts`). */
function attemptRecord(m, line) {
  const n = attemptNumbers(m);
  if (n === null) return null;
  const english = toEnglish(line.trim());
  const { cacheRead } = n;
  // Канон economy.cjs: R больше N — значит N записан без кэша, итог N + R.
  const tokens = n.tokens != null && cacheRead != null && cacheRead > n.tokens ? n.tokens + cacheRead : n.tokens;
  // Тег движка — первое слово описания (AGENTS.md §3); нет тега — `untagged`.
  const tag = /—\s*([a-z][a-z0-9-]*):/.exec(english);
  // id вызова — чтобы один вызов, записанный в нескольких карточках, считался один раз (как в tally.cjs).
  const idm = !ID_UNKNOWN_RE.test(english) && /`([^`\s]+)`\s*$/.exec(m[9] || '');
  const record = {
    callId: idm ? idm[1] : null,
    sessionSpend: /card-session-spend/.test(line),
    tokensUnknown: n.tokensUnknown,
    node: m[1],
    engine: tag ? tag[1] : 'untagged',
    date: m[2],
    tokens,
    // Кэш-чтение — постоянные накладные вызова: загрузка закона и роли (§3). Это и есть «инструктаж»;
    // остаток — работа собственно по карточке. Тоньше внутри одного вызова не делится.
    cacheRead,
    // Три состояния (ECONOMY.md, «The `unknown` marker»): число записано; поля нет вовсе (старая строка); движок числа
    // не вернул и узел это НАЗВАЛ. Третье считается отдельной величиной и никогда не складывается нулём.
    cacheReadUnknown: /cache-read unknown/.test(m[0]),
    work: cacheRead != null && tokens != null ? Math.max(0, tokens - cacheRead) : null,
    seconds: n.seconds,
    secondsUnknown: n.secondsUnknown,
    costUsd: m[7] ? parseFloat(m[7]) : 0,
    provider: m[8] || null,
    services: parseServices(m[9]),
  };
  // Метка границы окна (строка основной сессии, `card-session-spend`): приращения одной сессии различаются ею.
  // Поле только при метке — записи без неё остаются прежними, снимок данных не меняется.
  const windowEnd = sessionWindowEnd(line);
  if (windowEnd != null) record.windowEnd = windowEnd;
  return record;
}

/** Заходы узлов из строк расхода карточки. */
function parseAttempts(raw) {
  const attempts = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = ATTEMPT_LINE_RE.exec(toEnglish(line.trim()));
    if (m === null) continue;
    // Единственное место, где рождается запись расхода, — значит и единственные ворота для нечисла.
    const record = attemptRecord(m, line);
    if (record !== null) attempts.push(record);
  }
  return attempts;
}

module.exports = { parseAttempts, parseServiceLines, parseMalformedAttempts, parseClosedDate };
