'use strict';

/**
 * Карточка для доски и «Закона»: поля целиком — снаряжение по единицам, готовность к запуску, расход из строк
 * истории, связи по меткам. Отдельный разбор от счёта расхода (`cards.cjs`): доске нужна вся карточка,
 * счёту — только строки расхода.
 */

const { parseFrontmatterJson, zone } = require('../lib/card.cjs');
const i18n = require('../../i18n/index.cjs');
const APPROVAL_RE = new RegExp(i18n.alt('hist.approved'), 'i');

// Единицы снаряжения — английские ключи (kit.role …); лейблы по языкам — в i18n/keys.json.
const KIT_UNITS = ['role', 'skill', 'tool', 'access', 'data', 'model'];

// Снаряжение пишут и списком «- **Role:** …», и строкой «Role: … · Skill: …» — режем текст по лейблам единиц
// с заглавной (после лейбла допустимо до трёх букв окончания: Скиллы, Tools).
const KIT_KEY = new RegExp('(?:^|[\\s.·(;])((?:' + i18n.alt(...KIT_UNITS.map((u) => 'kit.' + u)) + ')\\p{L}{0,3})(?![\\p{L}])\\s*[:—–·-]?\\s*', 'gu');

const ATTEMPT_LINE = /: attempt,/;
const TOKENS_RE = /attempt,\s*([\d\s\u00a0\u202f]+)\s*tokens/;
const CACHE_RE = /\(([\d\s\u00a0\u202f]+)\s*cache-read\)/;

const spaceless = (s) => Number(String(s).replace(/[\s\u00a0\u202f]/g, ''));

/** Снаряжение по единицам: `{ role: '…', skill: '…' }`; несколько записей одной единицы склеиваются через « · ». */
function kitPartsOf(kit) {
  const parts = {};
  const flat = kit.replace(/\*\*/g, '');
  const hits = [...flat.matchAll(KIT_KEY)];
  hits.forEach((m, i) => {
    const u = KIT_UNITS.find((id) => i18n.isKey(m[1], 'kit.' + id));
    if (!u) return;
    const end = hits[i + 1] ? hits[i + 1].index : undefined;
    const val = flat.slice(m.index + m[0].length, end).replace(/^[\s·.:;-]+|[\s·.;-]+$/g, '').replace(/\s*\n\s*-?\s*/g, ' ');
    if (val) parts[u] = (parts[u] ? parts[u] + ' · ' : '') + val;
  });
  return parts;
}

/** Расход из одной строки истории (§3): `N tokens (R cache-read), T s`; токены и кэш — по тегу движка. */
function addSpendLine(spend, l) {
  spend.lines++;
  const tg = /—\s*([a-z][a-z0-9-]*):/.exec(l);
  const E = spend.byEngine[tg ? tg[1] : 'untagged'] || (spend.byEngine[tg ? tg[1] : 'untagged'] = { tokens: 0, cache: 0, lines: 0, unknown: 0 });
  E.lines++;
  const sm = l.match(/,\s*(\d+)\s*s,/);
  if (sm) spend.sec += +sm[1];
  const t = l.match(TOKENS_RE);
  if (!t || spaceless(t[1]) === 0) { spend.unknown++; E.unknown++; return; } // «0 tokens» по §3 — не число, а пропуск
  E.tokens += spaceless(t[1]);
  const r = l.match(CACHE_RE);
  if (!r) return;
  E.cache += spaceless(r[1]);
  if (spaceless(r[1]) > spaceless(t[1])) E.mixed = true; // кэш больше итога — N записан без кэша
}

/** Токены и кэш — по тегу движка (`spend.byEngine`): разные движки в одну сумму не идут. */
function spendOf(history) {
  const spend = { sec: 0, lines: 0, unknown: 0, byEngine: {} };
  for (const l of history) {
    if (ATTEMPT_LINE.test(l)) addSpendLine(spend, l);
  }
  return spend;
}

/**
 * Доступ: строка «Доступ» в снаряжении со статусом «подтверждён»/confirmed. Берём отрезок после «Доступ:»
 * до следующей единицы. `null` — строки нет; `'unknown'` — назван, но статус (запрет 15) не записан.
 */
function accessStatus(kit) {
  const am = kit.match(new RegExp('(?:' + i18n.alt('kit.access') + ')\\W*?:\\**\\s*([^·\\n]*)', 'i'));
  const accessText = am ? am[1].trim() : null;
  if (accessText === null) return null;
  if (i18n.hasPhrase(accessText, 'access_unconfirmed')) return false;
  if (i18n.hasPhrase(accessText, 'access_ok')) return true;
  return accessText ? 'unknown' : false;
}

// Даты этапов маршрута и строки о маршруте — по ключам истории (hist.approved / check / accepted / route); браузер слов не знает.
const dateOfLine = (history, key) => {
  const re = new RegExp(i18n.alt(key), 'i');
  const l = history.find((x) => re.test(x));
  const m = l && l.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
};
const routeDatesOf = (history) => ({
  approve: dateOfLine(history, 'hist.approved'), check: dateOfLine(history, 'hist.check'), accept: dateOfLine(history, 'hist.accepted'),
});
const routeLinesOf = (history) => history.filter((l) => /route-\d/i.test(l) || new RegExp(i18n.alt('hist.route'), 'i').test(l));

/** Готовность к запуску: цель, пять полей, снаряжение, маршрут, одобрение, доступ, остаток бюджета, зависимости. */
function readiness({ labels, fields, kit, history }, kitParts) {
  const route = labels.find((l) => /^route-\d$/.test(l)) || null;
  const kitUnits = KIT_UNITS.filter((n) => kitParts[n]);
  const spent = history.filter((l) => ATTEMPT_LINE.test(l)).length;
  const budgetN = parseInt(fields[3], 10);
  return {
    goal: labels.filter((l) => l.startsWith('goal-')).length === 1,
    task: fields.length >= 5 && fields.slice(0, 5).every(Boolean),
    kitUnits,
    route: !!route,
    approval: /^route-[0-5]$/.test(route || '') ? history.some((l) => APPROVAL_RE.test(l)) : null,
    kit: kitUnits.length === 6,
    access: accessStatus(kit),
    budgetLeft: Number.isFinite(budgetN) ? budgetN - spent : null,
    deps: labels.filter((l) => /^after-card-\d+$/.test(l)).map((l) => l.replace('after-', '')),
  };
}

/**
 * Карточка доски из файла `f` с текстом `text`; `.forma/skills` — имена скиллов проекта (какие из них названы в снаряжении).
 * Поле `text` временное — для поиска связей; из данных его удаляет `board.cjs`.
 */
function parseBoardCard(f, text, skills) {
  const fm = parseFrontmatterJson(text);
  const fields = zone(text, 'task').split('|').map((s) => s.trim());
  const history = zone(text, 'history').split(/\r?\n/).filter((l) => l.startsWith('- '));
  const labels = Array.isArray(fm.labels) ? fm.labels : [];
  const kit = zone(text, 'kit');
  const kitParts = kitPartsOf(kit);
  const skillText = kitParts.skill || '';
  const spendLines = history.filter((l) => ATTEMPT_LINE.test(l));
  const ready = readiness({ labels, fields, kit, history }, kitParts);
  return {
    ready,
    routeDates: routeDatesOf(history),
    routeLines: routeLinesOf(history),
    kitParts,
    kitSkills: skills.filter((n) => new RegExp('(^|[^\\w-])' + n + '([^\\w-]|$)').test(skillText)),
    spend: spendOf(history),
    historySpend: spendLines.map((l) => l.slice(2)),
    code: (f.match(/^card-\d+/) || [''])[0],
    title: (text.match(/^# (.+)$/m) || [null, f])[1].replace(/^card-\d+\s*·\s*/, ''),
    status: fm.status || 'backlog',
    assignee: fm.assignee ?? null,
    epic: fm.epic || '—',
    priority: fm.priority || 'medium',
    modified: fm.modified || fm.created || null,
    labels,
    goal: labels.find((l) => l.startsWith('goal-')) || null,
    route: labels.find((l) => /^route-\d$/.test(l)) || null,
    kind: (fields[0] || '').split('·')[1]?.trim() || '',
    delivers: fields[1] || '',
    criterion: fields[2] || '',
    budget: fields[3] || '',
    next: fields[4] || '',
    lastEvent: (history[history.length - 1] || '').slice(2),
    history: history.map((l) => l.slice(2)),
    text,
    attempts: spendLines.length,
  };
}

module.exports = { parseBoardCard };
