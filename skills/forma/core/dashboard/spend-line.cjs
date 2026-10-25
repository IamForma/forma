'use strict';

/**
 * Строка расхода (AGENTS.md §3) — одна кодировка для всех счётчиков.
 *
 * Канон — английский, при любом языке проекта:
 *   `Node`, YYYY-MM-DD: attempt, N tokens (R cache-read), O out, T s, `<id>` — <описание на языке карточки>
 * Сегмент «O out» — выходные токены; «out unknown» — движок их не вернул. Старые строки без сегмента читаются
 * как «out unknown» и не переписываются (запрет 5).
 * Русская форма («заход, N токенов (R кэш-чтение), T с», «(кэш-чтение неизвестно)»,
 * «id неизвестен») только ЧИТАЕТСЯ: старые строки не переписываются (запрет 5).
 * `toEnglish()` приводит к канону ключевую часть — всё до первого тире; описание не трогается.
 *
 * Пользователи: tally.cjs, sync-engines.cjs, tool-usage.cjs, .forma/dashboard/generate.js.
 * Разряды — ` `/` ` escape-последовательностями, не литералом: литеральный
 * неразрывный пробел в классе не находится `Edit`-ом (project/experience/razborschiki-stroki-rashoda.md).
 */

const path = require('path');
const engines = require('./lib/engines.cjs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DIGITS = '\\d[\\d \\u00a0\\u202f]*?';

function toEnglish(line) {
  const s = String(line);
  const cut = s.indexOf('—');
  const head = cut === -1 ? s : s.slice(0, cut);
  const rest = cut === -1 ? '' : s.slice(cut);
  const en = head
    .replace(/(\d{4}-\d{2}-\d{2}:\s*)заход,/g, '$1attempt,')
    .replace(new RegExp('(attempt,\\s*' + DIGITS + ')\\s*токен[а-яё]*', 'gu'), '$1 tokens')
    .replace(/\(\s*tokens unknown\s*\)/g, 'unknown tokens')
    .replace(/\(\s*time unknown\s*\)/g, 'unknown s')
    .replace(/\(\s*кэш-чтение неизвестно\s*\)/g, '(cache-read unknown)')
    .replace(/(\d)\s*кэш[^)]*\)/g, '$1 cache-read)')
    .replace(/id неизвестен/g, 'id unknown')
    .replace(/(,\s*\d+)\s*с(?![а-яё])/g, '$1 s');
  return en + rest;
}

/**
 * Ключевая часть написана не каноном: от даты до тире стоит кириллица
 * («заход», «токенов», «кэш-чтение», «с», единица сервиса вроде «кредитов»).
 * Подпись узла до даты не проверяется — это имя, не ключ.
 */
function isNonCanonical(line) {
  const s = String(line);
  const d = s.search(/\d{4}-\d{2}-\d{2}:/);
  if (d === -1) return false;
  const cut = s.indexOf('—', d);
  return /[Ѐ-ӿ]/.test(s.slice(d, cut === -1 ? s.length : cut));
}

// Сегмент выходных токенов: «, O out» или «, out unknown»; не захватывает, номера групп ниже не сдвигает.
const OUT_SEGMENT = '(?:,\\s*(?:' + DIGITS + '\\s*out(?![A-Za-z])|out unknown))?';
const OUT_RE = new RegExp(',\\s*(' + DIGITS + ')\\s*out(?![A-Za-z])');

// Группы: 1 узел, 2 дата, 3 токены (число или unknown), 4 кэш-чтение, 5 секунды, 6 turns, 7 $, 8 провайдер, 9 хвост до тире.
const SPEND_SOURCE =
  '`([^`]+)`,\\s*(\\d{4}-\\d{2}-\\d{2}):\\s*attempt,\\s*(' + DIGITS + '|unknown)\\s*tokens?(?![A-Za-z])' +
  '(?:\\s*\\(\\s*(' + DIGITS + ')\\s*cache-read\\s*\\)|\\s*\\(\\s*cache-read unknown\\s*\\))?' +
  OUT_SEGMENT +
  '(?:,\\s*(\\d+|unknown)\\s*s(?![A-Za-z]))?' +
  '(?:,\\s*(\\d+)\\s*turns?(?![A-Za-z]))?' +
  '(?:,\\s*\\$([\\d.]+)\\s*\\(([^)]+)\\))?' +
  '([^\\n—]*)';

/** Заявка на запись расхода (в каноне): дата, «attempt,». */
const CLAIM_RE = /\d{4}-\d{2}-\d{2}:\s*attempt,/;
const CACHE_UNKNOWN_RE = /\(\s*cache-read unknown\s*\)/;
const TOKENS_UNKNOWN_RE = /attempt,\s*unknown\s*tokens?/;
const ID_UNKNOWN_RE = /`?id unknown`?\s*—/;

const toInt = (s) => parseInt(String(s).replace(/[\s  ]/g, ''), 10);

/** Выходные токены строки расхода: число или `null` («out unknown» и старая строка без сегмента). */
function outTokens(line) {
  const s = String(line);
  const cut = s.indexOf('—');
  const m = OUT_RE.exec(cut === -1 ? s : s.slice(0, cut));
  return m ? toInt(m[1]) : null;
}

/**
 * Каноническая запись → строка расхода (без ведущего «- »). Движок-нейтрально: запись
 * приносит адаптер движка (для Claude — claude-economy.cjs). `null` → маркер `unknown`, не 0.
 * rec: node, date, tokens, cache_read, duration_s, turns, call_id, engine, desc.
 */
function formatSpendLine(rec) {
  const g = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const known = (v) => typeof v === 'number' && Number.isFinite(v);
  const N = known(rec.tokens) ? `${g(rec.tokens)} tokens` : 'unknown tokens';
  const R = known(rec.cache_read) ? `(${g(rec.cache_read)} cache-read)` : '(cache-read unknown)';
  const O = known(rec.tokens_out) ? `, ${g(rec.tokens_out)} out` : ', out unknown';
  const T = known(rec.duration_s) ? `${rec.duration_s} s` : 'unknown s';
  const K = known(rec.turns) ? `, ${rec.turns} turns` : '';
  const id = rec.call_id ? `\`${rec.call_id}\`` : '`id unknown`';
  const tail = (rec.engine ? `${rec.engine}: ` : '') + (rec.desc || '');
  return `\`${rec.node}\`, ${rec.date}: attempt, ${N} ${R}${O}, ${T}${K}, ${id} — ${tail}`;
}

/**
 * Регулярки проверок доски и счёта по опознавателям — все, что читают строку расхода, живут в этом модуле.
 * Каждая — со своей строгостью (проверка формата строже счёта); слияние их в одну изменило бы, какие строки
 * доска называет нарушением, поэтому это разные выражения, а не одно с флагами.
 * Разряды — ` `/` ` escape-последовательностями, не литералом (см. комментарий вверху файла).
 */
// Строка заявляет себя записью расхода: пункт списка, дата, «заход,»/«attempt,».
const RU_CLAIM_LINE_RE = /^-\s.*?(\d{4}-\d{2}-\d{2}):\s*заход,/;
const EN_CLAIM_LINE_RE = /^-\s.*?(\d{4}-\d{2}-\d{2}):\s*attempt,/;
const CLAIM_LINE_RE = /^-\s.*\d{4}-\d{2}-\d{2}:\s*attempt,/;
// Полный формат §3 — узел, дата, число токенов или unknown, слово token.
const PARSES_RE = /`([^`]+)`,\s*\d{4}-\d{2}-\d{2}:\s*attempt,\s*(?:(?=[\d\s ]*\d)[\d\s ]+|unknown)\s*token/;
// Число токенов (1 узел, 2 дата, 3 токены), без unknown; и с unknown.
const SPEND_TOKENS_RE = /`([^`]+)`,\s*(\d{4}-\d{2}-\d{2}):\s*attempt,\s*((?=[\d\s  ]*\d)[\d\s  ]+)\s*token/;
const SPEND_TOKENS_OR_UNKNOWN_RE = /`([^`]+)`,\s*(\d{4}-\d{2}-\d{2}):\s*attempt,\s*((?=[\d\s  ]*\d)[\d\s  ]+|unknown)\s*token/;
// Токены, кэш-чтение и секунды разом (глобальная: проход по тексту карточки; lastIndex сбрасывает вызывающий).
const ATTEMPT_FORMAT_RE = /`([^`]+)`,\s*(\d{4}-\d{2}-\d{2}):\s*attempt,\s*((?=[\d\s  ]*\d)[\d\s  ]+?)\s*tokens?(?![A-Za-z])(\s*\(\s*(?=[\d\s  ]*\d)[\d\s  ]+\s*cache-read\s*\)|\s*\(\s*cache-read unknown\s*\))?(?:,\s*(?:\d[\d   ]*?\s*out(?![A-Za-z])|out unknown))?(,\s*\d+\s*s(?![A-Za-z]))?/g;
// Опознаватель вызова — последнее поле блока расхода перед тире: сам id (Claude agent_id — hex/uuid,
// без кавычек или в них; опознаватель внешнего провайдера — в обратных кавычках, буквы/цифры/дефис,
// внешние id не сводятся к hex, AGENTS.md §3 «External model») или маркер unknown.
const HAS_CALL_ID_RE = /,\s*(?:`?(?:[0-9a-f]{8,}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})`?|`[A-Za-z][\w-]{9,}`|`?id unknown`?)\s*—/i;
// Метка движка после тире строится из меток загруженных адаптеров (`spendTag`, `engine`, `id`): ни одно имя
// движка здесь не зашито. Метка вне списка — нарушение. Адаптеров нет — судить не по чему: годится любая метка вида `имя:`.
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ANY_TAG = '[a-z][a-z0-9-]*';
// Без списка адаптеров: годится любая метка вида `имя:` (то же, что `engineTagRe` при пустом списке).
const ENGINE_TAG_RE = new RegExp('\\s—\\s*' + ANY_TAG + ':');
function engineTagRe(root) {
  const tags = engines.spendTags(root || PROJECT_ROOT);
  const alt = tags.length ? tags.map(escapeRe).join('|') : ANY_TAG;
  return new RegExp('\\s—\\s*(?:' + alt + '):');
}
// Опознаватель для сшивки карточки с журналом инструментов: 1 узел, 2 дата, 3 id (или маркер unknown).
// Внешний id (ветка `[A-Za-z][\w-]{9,}`) журналу инструментов неизвестен — сшивки не даёт, но строка
// остаётся разборной, не отбрасывается как бракованная.
const CALL_ID_RE = /`([^`]+)`,\s*(\d{4}-\d{2}-\d{2}):\s*attempt,[^\n—]*?,\s*`?([0-9a-f]{8,}|[A-Za-z][\w-]{9,})`?\s*—/;
const CALL_ID_UNKNOWN_RE = /^-\s*`([^`]+)`,\s*(\d{4}-\d{2}-\d{2}):\s*attempt,[^\n—]*?`?id unknown`?\s*—/;

// Правая граница окна строки основной сессии (card-session-spend): точная метка в описании после тире.
// Одна сессия по одной карточке пишется несколькими строками — каждая только за новые ответы; метка —
// граница «уже учтено» для повторной записи и часть ключа дедупликации в счётчиках. Нет метки — null.
const SESSION_WINDOW_END_RE = new RegExp('(?:' + require('../i18n/index.cjs').alt('hist.window_end') + ') (\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z)');
const sessionWindowEnd = (line) => { const m = SESSION_WINDOW_END_RE.exec(line); return m ? Date.parse(m[1]) : null; };

// Ключ дедупликации строки расхода — один для tally.cjs и вкладки (data/attempts.cjs): иначе итоги расходятся.
// Строка основной сессии (card-session-spend) несёт id сессии, общий для всех карточек сессии, а доля у каждой своя:
// ключ — карточка + id + граница окна (приращения одной сессии считаются все; без метки — накопительные схлопываются в первую).
// Пакетный вызов (Spec/Kit, kit.md «Task kitting»): расход делится между карточками, и доли могут случайно совпасть;
// метка `batch I/K` — ключ берёт файл карточки и саму долю, а не числа. Обычные строки: id плюс числа захода
// (один вызов в двух карточках теми же числами — дубль; общий id с разными числами — разные окна).
// `m` — совпадение SPEND_SOURCE: 3 токены, 4 кэш-чтение, 5 секунды.
const BATCH_SHARE_RE = /\(batch\s+(\d+)\/(\d+)\)/;

function dedupKey(line, file, id, m) {
  if (/card-session-spend/.test(line)) return path.basename(file) + '|' + id + '|' + (sessionWindowEnd(line) ?? '');
  const batch = BATCH_SHARE_RE.exec(line);
  if (batch) return path.basename(file) + '|' + id + '|batch|' + batch[1] + '/' + batch[2];
  return [id, m[3], m[4] ?? '', m[5] ?? ''].join('|');
}

module.exports = {
  SESSION_WINDOW_END_RE, sessionWindowEnd, BATCH_SHARE_RE, dedupKey,
  formatSpendLine, outTokens, toEnglish, isNonCanonical, SPEND_SOURCE, CLAIM_RE, CACHE_UNKNOWN_RE, TOKENS_UNKNOWN_RE, ID_UNKNOWN_RE, toInt,
  RU_CLAIM_LINE_RE, EN_CLAIM_LINE_RE, CLAIM_LINE_RE, PARSES_RE, SPEND_TOKENS_RE, SPEND_TOKENS_OR_UNKNOWN_RE,
  ATTEMPT_FORMAT_RE, HAS_CALL_ID_RE, ENGINE_TAG_RE, engineTagRe, CALL_ID_RE, CALL_ID_UNKNOWN_RE,
};
