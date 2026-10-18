'use strict';

// Метки маршрута. С дня вступления правила у карточки ровно одна route-N; route-0…route-5 открываются только
// одобрением пяти полей человеком (вне backlog) — строка `Intent` «человек одобрил…» в истории. Старая метка
// route-intent-run читается как route-2. after-card-NNN — на существующую карточку и из более ранней волны.

const fs = require('fs');
const path = require('path');
const { cardFiles, boardDir, labelsOf, createdDay } = require('../../dashboard/lib/card.cjs');

const APPROVAL_RE = /(human approved|человек одобрил|человек принял)/i;

/** Карточки доски по номеру: `Map NNN → { name, labels, text, created }`. */
function readCards(root) {
  const cards = new Map();
  for (const file of cardFiles(root, /^card-\d+.*\.md$/)) {
    const name = path.basename(file);
    const text = fs.readFileSync(file, 'utf8');
    const labels = labelsOf(text).map((l) => (l === 'route-intent-run' ? 'route-2' : l));
    cards.set(name.match(/^card-(\d+).*\.md$/)[1], { name, labels, text, created: createdDay(text) });
  }
  return cards;
}

const waveOf = (c) => {
  const w = c.labels.find((l) => /^wave-\d+$/.test(l));
  return w ? +w.slice(5) : null;
};

/** Формы меток: route-0…8, over-1…4, wave-/seg- — натуральные числа. */
function formProblems({ name, labels }) {
  const problems = [];
  for (const l of labels.filter((l) => /^route-/.test(l))) {
    if (!/^route-[0-8]$/.test(l)) problems.push(`${name}: метка ${l} — нет такого маршрута (route-0…route-8)`);
  }
  for (const l of labels.filter((l) => /^over-/.test(l))) {
    if (!/^over-[1-4]$/.test(l)) problems.push(`${name}: метка ${l} — нет такого наложения (over-1…over-4)`);
  }
  for (const l of labels.filter((l) => /^(wave|seg)-/.test(l))) {
    if (!/^(wave|seg)-[1-9]\d*$/.test(l)) problems.push(`${name}: метка ${l} — номер должен быть натуральным`);
  }
  return problems;
}

/** Ровно одна метка маршрута; route-0…5 — с одобрением пяти полей (в backlog его ещё ждут — это законно). */
function routeProblems(c) {
  const routes = c.labels.filter((l) => /^route-/.test(l));
  if (routes.length !== 1) return [`${c.name}: меток маршрута ${routes.length}, нужна ровно одна (route-0…route-8)`];
  if (!/^route-[0-5]$/.test(routes[0]) || /^status:\s*"backlog"/m.test(c.text)) return [];
  // §7: одобрение — строка-событие без `attempt`; прежние строки «attempt, 0 tokens, 0 s» тоже засчитываются.
  const approved = c.text.split('\n').some((l) => /^-\s*`Intent`/.test(l) && APPROVAL_RE.test(l) &&
    (/0 tokens, 0 s/.test(l) || !/:\s*attempt,/.test(l)));
  return approved ? [] : [`${c.name}: ${routes[0]} без одобрения пяти полей человеком — нет строки-события \`Intent\` «человек одобрил…» (без attempt) в истории`];
}

/** after-card-NNN: форма метки, существование карточки и более ранняя волна. */
function afterProblems(c, cards) {
  const problems = [];
  const w = waveOf(c);
  for (const l of c.labels.filter((l) => /^after-/.test(l))) {
    const am = l.match(/^after-card-(\d{3,})$/);
    if (!am) { problems.push(`${c.name}: метка ${l} — ожидается after-card-NNN`); continue; }
    const dep = cards.get(am[1]);
    if (!dep) { problems.push(`${c.name}: ${l} — карточки card-${am[1]} на доске нет`); continue; }
    const dw = waveOf(dep);
    if (w !== null && dw !== null && !(w > dw)) problems.push(`${c.name}: ${l} — зависимость из волны wave-${dw}, а карточка в wave-${w}; нужна более ранняя волна`);
  }
  return problems;
}

function run({ root, since }) {
  if (!fs.existsSync(boardDir(root))) return [];
  const cards = readCards(root);
  const problems = [];
  for (const c of cards.values()) {
    if (c.created < since) continue;
    problems.push(...formProblems(c), ...routeProblems(c), ...afterProblems(c, cards));
  }
  return problems;
}

module.exports = { id: 'route-labels', since: 'route-labels', run };
