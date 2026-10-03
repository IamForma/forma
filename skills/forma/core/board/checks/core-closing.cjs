'use strict';

// Карточка в `done` с `assignee: "Core"` — принята человеком, но `Core` её ещё не закрыл (§7, «`done` — два состояния
// в одной колонке»). Переезд файла в `done/` делает расширение доски само, в момент смены статуса, и держать ворота
// на нём нельзя — поэтому воротами служит `assignee`, а чтобы они не стали пустой формальностью, их видно отсюда.
//
// Карточки, закрытые ДО введения правила, сюда не попадают: у них `assignee: null`, и требовать от них строки
// `закрыто —` задним числом было бы требованием переписать историю, а не соблюсти правило.

const fs = require('fs');
const path = require('path');
const { boardDir } = require('../../dashboard/lib/card.cjs');
const { bulletList } = require('./support/lines.cjs');

function run({ root }) {
  const done = path.join(boardDir(root), 'done');
  if (!fs.existsSync(done)) return [];
  const waiting = [];
  for (const f of fs.readdirSync(done)) {
    if (!f.endsWith('.md')) continue;
    const m = fs.readFileSync(path.join(done, f), 'utf8').match(/^assignee:\s*"?([^"\n]*)"?\s*$/m);
    if (m && m[1].trim() === 'Core') waiting.push(f);
  }
  if (!waiting.length) return [];
  return [`${waiting.length} карточек приняты человеком, но не закрыты \`Core\` ` +
    `(в \`done\` с assignee: "Core"):\n      ` + bulletList(waiting)];
}

module.exports = { id: 'core-closing', since: null, run };
