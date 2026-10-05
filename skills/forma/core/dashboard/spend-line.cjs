'use strict';

/**
 * Строка расхода (AGENTS.md §3) — одна кодировка для всех счётчиков.
 *
 * Канон — английский, при любом языке проекта:
 *   `Node`, YYYY-MM-DD: attempt, N tokens (R cache-read), T s, `<id>` — <описание на языке карточки>
 * Русская форма («заход, N токенов (R кэш-чтение), T с», «(кэш-чтение неизвестно)»,
 * «id неизвестен») только ЧИТАЕТСЯ: старые строки не переписываются (запрет 5).
 * `toEnglish()` приводит к канону ключевую часть — всё до первого тире; описание не трогается.
 *
 * Пользователи: tally.cjs, sync-engines.cjs, tool-usage.cjs, .forma/dashboard/generate.js.
 * Разряды — ` `/` ` escape-последовательностями, не литералом: литеральный
 * неразрывный пробел в классе не находится `Edit`-ом (project/experience/razborschiki-stroki-rashoda.md).
 */

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

// Группы: 1 узел, 2 дата, 3 токены (число или unknown), 4 кэш-чтение, 5 секунды, 6 $, 7 провайдер, 8 хвост до тире.
const SPEND_SOURCE =
  '`([^`]+)`,\\s*(\\d{4}-\\d{2}-\\d{2}):\\s*attempt,\\s*(' + DIGITS + '|unknown)\\s*tokens?(?![A-Za-z])' +
  '(?:\\s*\\(\\s*(' + DIGITS + ')\\s*cache-read\\s*\\)|\\s*\\(\\s*cache-read unknown\\s*\\))?' +
  '(?:,\\s*(\\d+|unknown)\\s*s(?![A-Za-z]))?' +
  '(?:,\\s*\\$([\\d.]+)\\s*\\(([^)]+)\\))?' +
  '([^\\n—]*)';

/** Заявка на запись расхода (в каноне): дата, «attempt,». */
const CLAIM_RE = /\d{4}-\d{2}-\d{2}:\s*attempt,/;
const CACHE_UNKNOWN_RE = /\(\s*cache-read unknown\s*\)/;
const TOKENS_UNKNOWN_RE = /attempt,\s*unknown\s*tokens?/;
const ID_UNKNOWN_RE = /`?id unknown`?\s*—/;

const toInt = (s) => parseInt(String(s).replace(/[\s  ]/g, ''), 10);

/**
 * Каноническая запись → строка расхода (без ведущего «- »). Движок-нейтрально: запись
 * приносит адаптер движка (для Claude — claude-economy.cjs). `null` → маркер `unknown`, не 0.
 * rec: node, date, tokens, cache_read, duration_s, call_id, engine, desc.
 */
function formatSpendLine(rec) {
  const g = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const known = (v) => typeof v === 'number' && Number.isFinite(v);
  const N = known(rec.tokens) ? `${g(rec.tokens)} tokens` : 'unknown tokens';
  const R = known(rec.cache_read) ? `(${g(rec.cache_read)} cache-read)` : '(cache-read unknown)';
  const T = known(rec.duration_s) ? `${rec.duration_s} s` : 'unknown s';
  const id = rec.call_id ? `\`${rec.call_id}\`` : '`id unknown`';
  const tail = (rec.engine ? `${rec.engine}: ` : '') + (rec.desc || '');
  return `\`${rec.node}\`, ${rec.date}: attempt, ${N} ${R}, ${T}, ${id} — ${tail}`;
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
const ATTEMPT_FORMAT_RE = /`([^`]+)`,\s*(\d{4}-\d{2}-\d{2}):\s*attempt,\s*((?=[\d\s  ]*\d)[\d\s  ]+?)\s*tokens?(?![A-Za-z])(\s*\(\s*(?=[\d\s  ]*\d)[\d\s  ]+\s*cache-read\s*\)|\s*\(\s*cache-read unknown\s*\))?(,\s*\d+\s*s(?![A-Za-z]))?/g;
// Опознаватель вызова — последнее поле блока расхода перед тире: сам id или маркер unknown.
const HAS_CALL_ID_RE = /,\s*(?:`?(?:[0-9a-f]{8,}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})`?|`?id unknown`?)\s*—/i;
// Метка движка после тире.
const ENGINE_TAG_RE = /\s—\s*(?:claude-code|codex|gemini):/;
// Опознаватель для сшивки карточки с журналом инструментов: 1 узел, 2 дата, 3 id (или маркер unknown).
const CALL_ID_RE = /`([^`]+)`,\s*(\d{4}-\d{2}-\d{2}):\s*attempt,[^\n—]*?,\s*`?([0-9a-f]{8,})`?\s*—/;
const CALL_ID_UNKNOWN_RE = /^-\s*`([^`]+)`,\s*(\d{4}-\d{2}-\d{2}):\s*attempt,[^\n—]*?`?id unknown`?\s*—/;

// Правая граница окна строки основной сессии (card-session-spend): точная метка в описании после тире.
// Одна сессия по одной карточке пишется несколькими строками — каждая только за новые ответы; метка —
// граница «уже учтено» для повторной записи и часть ключа дедупликации в счётчиках. Нет метки — null.
const SESSION_WINDOW_END_RE = /граница (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/;
const sessionWindowEnd = (line) => { const m = SESSION_WINDOW_END_RE.exec(line); return m ? Date.parse(m[1]) : null; };

module.exports = {
  SESSION_WINDOW_END_RE, sessionWindowEnd,
  formatSpendLine, toEnglish, isNonCanonical, SPEND_SOURCE, CLAIM_RE, CACHE_UNKNOWN_RE, TOKENS_UNKNOWN_RE, ID_UNKNOWN_RE, toInt,
  RU_CLAIM_LINE_RE, EN_CLAIM_LINE_RE, CLAIM_LINE_RE, PARSES_RE, SPEND_TOKENS_RE, SPEND_TOKENS_OR_UNKNOWN_RE,
  ATTEMPT_FORMAT_RE, HAS_CALL_ID_RE, ENGINE_TAG_RE, CALL_ID_RE, CALL_ID_UNKNOWN_RE,
};
