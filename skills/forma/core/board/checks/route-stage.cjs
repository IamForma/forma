'use strict';

// Причина и этап маршрута (AGENTS.md §6). С дня вступления правила: строка «route route-N (why: <код>)» обязательна,
// код и ключ этапа — из закрытых списков, последняя строка «stage <ключ>» не противоречит статусу.
// Нет строки этапа — не нарушение (этап по статусу).

const fs = require('fs');
const path = require('path');
const { cardFiles, createdDay } = require('../../dashboard/lib/card.cjs');

const WHY_CODES = ['human', 'ready', 'scale', 'risk', 'decision', 'tooling'];
const STAGE_KEYS = ['card', 'approve', 'kit', 'exec', 'check', 'accept', 'close'];
const STAGE_BY_STATUS = { backlog: ['card', 'approve'], todo: ['kit'], 'in-progress': ['kit', 'exec'], review: ['check', 'accept'], done: ['accept', 'close'] };

function cardProblems(f, text) {
  const problems = [];
  const lines = text.split('\n').filter((l) => /^-\s*`\w+`,\s*\d{4}-\d{2}-\d{2}:/.test(l));
  const whys = lines.map((l) => l.match(/:\s*route route-\d[^(—]*\(why:\s*([^)]*)\)/)).filter(Boolean);
  if (!whys.length) problems.push(`${f}: нет строки причины маршрута «route route-N (why: <код>)» в истории`);
  for (const m of whys) {
    if (!WHY_CODES.includes(m[1].trim())) problems.push(`${f}: причина маршрута «${m[1].trim()}» — нет такого кода (${WHY_CODES.join('|')})`);
  }
  const stages = lines.map((l) => l.match(/:\s*stage\s+(\S+?)(?=\s|—|\.|$)/)).filter(Boolean).map((m) => m[1]);
  for (const s of stages) if (!STAGE_KEYS.includes(s)) problems.push(`${f}: этап «${s}» — нет такого ключа (${STAGE_KEYS.join('|')})`);
  const status = (text.match(/^status:\s*"?([\w-]+)/m) || [])[1];
  const last = stages[stages.length - 1];
  if (last && STAGE_KEYS.includes(last) && STAGE_BY_STATUS[status] && !STAGE_BY_STATUS[status].includes(last)) {
    problems.push(`${f}: последний этап «${last}» не сходится со статусом ${status} (ожидается ${STAGE_BY_STATUS[status].join('|')})`);
  }
  return problems;
}

function run({ root, since }) {
  const problems = [];
  for (const file of cardFiles(root, /^card-\d+.*\.md$/)) {
    const text = fs.readFileSync(file, 'utf8');
    if (createdDay(text) >= since) problems.push(...cardProblems(path.basename(file), text));
  }
  return problems;
}

module.exports = { id: 'route-stage', since: 'route-stage', run };
