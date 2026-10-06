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

test('card-move: расход — строка attempt перед строкой этапа, tally её читает', () => {
  const f = makeFixture();
  try {
    const p = path.join(f.root, '.devtool', 'features', ID + '.md');
    const ok = run(f, [MOVE, '001', '--to', 'run', '--note', 'комплект готов', '--tokens', '52339', '--duration-ms', '41500',
      '--agent-id', 'a1b2c3d4e5f60718', '--cache-read', '40100', '--turns', '7']);
    assert.equal(ok.status, 0, ok.out);
    const text = fs.readFileSync(p, 'utf8');
    assert.match(text, /^- `Kit`, \d{4}-\d{2}-\d{2}: attempt, 52 339 tokens \(40 100 cache-read\), 42 s, 7 turns, `a1b2c3d4e5f60718` — claude-code: комплект готов\.\n- `Kit`, \d{4}-\d{2}-\d{2}: stage exec — комплект готов\.\n\n## Результат/m);
    const noR = run(f, [MOVE, '001', '--to', 'intent', '--note', 'готово', '--tokens', '900', '--duration-ms', '3000', '--agent-id', 'c3d4e5f6a7b80912']);
    assert.equal(noR.status, 0, noR.out);
    assert.match(fs.readFileSync(p, 'utf8'), /attempt, 900 tokens \(cache-read unknown\), 3 s, `c3d4e5f6a7b80912` — claude-code: готово\. cache-read движок не вернул\./);
    assert.equal(run(f, ['.forma/board/check-board.cjs']).status, 0);
    assert.equal(run(f, [MOVE, '001', '--to', 'accept', '--note', 'x', '--tokens', '5']).status, 2, 'не все поля расхода');
    assert.equal(run(f, [MOVE, '001', '--to', 'accept', '--note', 'x', '--tokens', 'abc', '--duration-ms', '1', '--agent-id', 'z']).status, 2);
  } finally { f.cleanup(); }
});
