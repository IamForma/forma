'use strict';

// Карточки в `done` с `assignee: "Core"` — приняты человеком, ждут закрытия цикла `Core` (§7, «`done` — два состояния
// в одной колонке»). Это штатная очередь, а не нарушение: карточки копируются, пока цикл не наберёт объём или человек
// не позовёт `Core`. Поэтому проверка ничего не возвращает в нарушения — только кладёт в `ctx.info` одну строку-сведение
// (если запускающий его дал). Красным очередь не бывает.
//
// Карточки, закрытые ДО введения правила, сюда не попадают: у них `assignee: null`.

const fs = require('fs');
const path = require('path');
const { boardDir } = require('../../dashboard/lib/card.cjs');

function run({ root, info }) {
  const done = path.join(boardDir(root), 'done');
  if (!info || !fs.existsSync(done)) return [];
  let waiting = 0;
  for (const f of fs.readdirSync(done)) {
    if (!f.endsWith('.md')) continue;
    const m = fs.readFileSync(path.join(done, f), 'utf8').match(/^assignee:\s*"?([^"\n]*)"?\s*$/m);
    if (m && m[1].trim() === 'Core') waiting++;
  }
  if (waiting) info.push(`  очередь Core: ${waiting} карточек ждут закрытия цикла — штатно, не нарушение`);
  return [];
}

module.exports = { id: 'core-closing', since: null, run };
