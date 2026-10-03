// Общее для всех вкладок: справочники статусов, форматирование чисел и дат.
// Грузится первым; остальные файлы — классические скрипты в одной глобальной области.

const STATUS_LABEL = {backlog:"Backlog", todo:"Todo", "in-progress":"В работе", review:"Review", done:"Done"};
const STATUS_VAR = {backlog:"--st-backlog", todo:"--st-todo", "in-progress":"--st-progress", review:"--st-review", done:"--st-done"};
const STATUS_ORDER = ["backlog","todo","in-progress","review","done"];
const EPIC_COLORS = ["#2D7D8C","#5B6FD6","#B0562E","#A23B54","#6E8F3E","#8A5FBF","#2E8B7A","#4E6E8E"];

function fmt(n){ return n.toLocaleString('ru-RU'); }
// Заголовки карточек приходят из markdown и могут нести угловые скобки —
// в шаблонную строку они подставляются как разметка, поэтому экранируем.
function esc(s){ return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function timeAgo(isoLike){
  // lastRunAt хранится как "ГГГГ-ММ-ДД ЧЧ:ММ" (локальное время того, кто писал строку) — не ISO,
  // парсим вручную, без часового пояса, только для грубой оценки «сколько времени назад».
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(isoLike);
  if (!m) return isoLike;
  const then = new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
  const diffMs = Date.now() - then.getTime();
  const h = diffMs / 3600000;
  if (h < 1) return Math.max(1, Math.round(h*60)) + ' мин назад';
  if (h < 48) return Math.round(h) + ' ч назад';
  return Math.round(h/24) + ' дн назад';
}

const hhmm = (s) => {
  if (!s) return '—';
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
// Русское числительное согласуется: 1 карточка, 2-4 карточки, 5+ карточек.
// Без этого подписи читаются как машинный перевод.
function plural(n, one, few, many){
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
