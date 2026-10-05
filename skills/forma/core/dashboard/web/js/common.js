// Общее для всех вкладок: справочники статусов, форматирование чисел и дат.
// Грузится первым; остальные файлы — классические скрипты в одной глобальной области.

const STATUS_LABEL = new Proxy({}, { get: (_, s) => (typeof s === 'string' ? t('board.col.' + s) : undefined) });
const STATUS_VAR = {backlog:"--st-backlog", todo:"--st-todo", "in-progress":"--st-progress", review:"--st-review", done:"--st-done"};
const STATUS_ORDER = ["backlog","todo","in-progress","review","done"];
const EPIC_COLORS = ["#2D7D8C","#5B6FD6","#B0562E","#A23B54","#6E8F3E","#8A5FBF","#2E8B7A","#4E6E8E"];

// Подпись с числом: форму (one/few/many/other) выбирает словарь через Intl.PluralRules, число форматируется по языку.
const cnt = (key, n) => t(key, {n, num: fmt(n)});
const curLang = () => (typeof i18nLang === 'function' ? i18nLang() : 'en');
function fmt(n){ return new Intl.NumberFormat(curLang()).format(n); }
// Относительное время («5 минут» / «5 minutes» в прошлом): формы и порядок слов даёт Intl по языку.
function relTime(minutes){
  const rtf = new Intl.RelativeTimeFormat(curLang(), {numeric:'auto'});
  if (minutes < 60) return rtf.format(-Math.max(1, Math.round(minutes)), 'minute');
  if (minutes < 48 * 60) return rtf.format(-Math.round(minutes / 60), 'hour');
  return rtf.format(-Math.round(minutes / 1440), 'day');
}
// Заголовки карточек приходят из markdown и могут нести угловые скобки —
// в шаблонную строку они подставляются как разметка, поэтому экранируем.
function esc(s){ return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function timeAgo(isoLike){
  // lastRunAt хранится как "ГГГГ-ММ-ДД ЧЧ:ММ" (локальное время того, кто писал строку) — не ISO,
  // парсим вручную, без часового пояса, только для грубой оценки «как давно».
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(isoLike);
  if (!m) return isoLike;
  const then = new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
  const diffMs = Date.now() - then.getTime();
  return relTime(diffMs / 60000);
}

const hhmm = (s) => {
  if (!s) return '—';
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? t('time.hm', {h, m}) : t('time.m', {m});
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
