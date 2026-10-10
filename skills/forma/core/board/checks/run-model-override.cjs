'use strict';

// `Run` исполняет на `haiku` по умолчанию (kit.md, «Снаряжение задачи»; route-choice.md, «`Run` runs on
// `haiku` by default»). Более сильная модель (`sonnet` и выше) — подъём, и у него должна быть причина:
// строка в `## История`, написанная до передачи карточки `Run`, со словом «override»/«оверрайд»/«подъём». Без неё
// запись в `## Снаряжение`/`## Kit` молча поднимает модель, и `Core` не может проверить выбор по факту.

const fs = require('fs');
const path = require('path');
const { cardFiles, createdDay, zone } = require('../../dashboard/lib/card.cjs');

const STRONGER_MODEL_RE = /\b(sonnet|opus)\b/i;
const OVERRIDE_LINE_RE = /\boverride\b|оверрайд|подъ[её]м/i;
// Короткий маршрут (`route-0`, `route-4`): карточку исполняет `Intent`/`Kit` сам, `Run` не вызывается — модель в
// `## Снаряжение` там модель самого узла (frontmatter), а не подъём модели `Run`.
const NO_RUN_ROUTE_RE = /\broute-[04]\b/;

function frontmatter(text) {
  const end = text.indexOf('\n---', 4);
  return end < 0 ? '' : text.slice(0, end);
}

function cardProblem(f, text) {
  if (NO_RUN_ROUTE_RE.test(frontmatter(text))) return null;
  const kitZone = zone(text, 'kit');
  if (!STRONGER_MODEL_RE.test(kitZone)) return null;
  const historyZone = zone(text, 'history');
  if (OVERRIDE_LINE_RE.test(historyZone)) return null;
  return `${f}: Снаряжение называет модель сильнее haiku (${kitZone.match(STRONGER_MODEL_RE)[0]}), ` +
    `а в «Истории» нет строки с причиной подъёма (override) — kit.md, «Снаряжение задачи»`;
}

function run({ root, since }) {
  const problems = [];
  for (const file of cardFiles(root, /^card-\d+.*\.md$/)) {
    const text = fs.readFileSync(file, 'utf8');
    if (createdDay(text) < since) continue;
    const p = cardProblem(path.basename(file), text);
    if (p) problems.push(p);
  }
  return problems;
}

module.exports = { id: 'run-model-override', since: 'run-model-override', run };
