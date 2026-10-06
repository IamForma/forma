// card-move.cjs: передача карточки одним вызовом (AGENTS.md §6–7) на учебной фикстуре.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture } = require('./helpers/fixture.cjs');
const { run } = require('./helpers/outputs.cjs');

let fx;
test.before(() => { fx = makeFixture(); });
test.after(() => { if (fx) fx.cleanup(); });

const MOVE = '.forma/board/card-move.cjs';
const live = (id) => path.join(fx.root, '.devtool', 'features', id + '.md');
const done = (id) => path.join(fx.root, '.devtool', 'features', 'done', id + '.md');
const ID = 'card-001-nastroit-sborku-primera';

test('card-move: полный круг — status, assignee, строка этапа, проверка доски чистая', () => {
  const steps = [
    ['kit', 'todo', 'Kit', 'kit'], ['run', 'in-progress', 'Kit', 'exec'], ['intent', 'review', 'Intent', 'check'],
    ['accept', 'review', 'Intent', 'accept'],
  ];
  for (const [to, status, assignee, stage] of steps) {
    const r = run(fx, [MOVE, '001', '--to', to, '--note', 'проба ' + to]);
    assert.equal(r.status, 0, r.out);
    const text = fs.readFileSync(live(ID), 'utf8');
    assert.match(text, new RegExp(`^status: "${status}"$`, 'm'));
    assert.match(text, new RegExp(`^assignee: "${assignee}"$`, 'm'));
    assert.match(text, new RegExp(`^- \`\\w+\`, \\d{4}-\\d{2}-\\d{2}: stage ${stage} — проба ${to}\\.$\\n\\n## Результат`, 'm'));
  }
  assert.equal(run(fx, ['.forma/board/check-board.cjs']).status, 0);
});

test('card-move: close — done/Core, completedAt, файл уходит в done/', () => {
  const r = run(fx, [MOVE, 'card-001', '--to', 'close', '--note', 'человек принял']);
  assert.equal(r.status, 0, r.out);
  assert.ok(!fs.existsSync(live(ID)) && fs.existsSync(done(ID)));
  const text = fs.readFileSync(done(ID), 'utf8');
  assert.match(text, /^status: "done"$/m);
  assert.match(text, /^assignee: "Core"$/m);
  assert.match(text, /^completedAt: "\d{4}-/m);
  assert.equal(run(fx, [MOVE, '001', '--to', 'kit', '--note', 'x']).status, 2, 'закрытую не передают');
});

test('card-move: ошибки ввода — код 2, файл не тронут', () => {
  assert.equal(run(fx, [MOVE, '001', '--to', 'nowhere', '--note', 'x']).status, 2);
  assert.equal(run(fx, [MOVE, '001', '--to', 'kit']).status, 2, 'без --note');
  assert.equal(run(fx, [MOVE, '999', '--to', 'kit', '--note', 'x']).status, 2, 'нет карточки');
});
