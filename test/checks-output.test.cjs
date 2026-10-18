// Тексты вывода проверок на фикстуре с порчей (по случаю на проверку и все разом) совпадают с записанными
// в test/fixture/golden/. Рефакторинг проверок не меняет ни находки, ни их порядок, ни слова.
// Записать заново: UPDATE_GOLDEN=1 npm test (после осознанной правки текста находки).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture } = require('./helpers/fixture.cjs');
const { run } = require('./helpers/outputs.cjs');
const { mutator } = require('./helpers/mutate.cjs');
const { CASES, CHECKS_JSON } = require('./helpers/check-cases.cjs');

const GOLDEN = path.join(__dirname, 'fixture', 'golden');
const BOARD = ['.forma/board/check-board.cjs'];
const syncArgs = (c) => ['.claude/scripts/sync-engines.cjs', ...(c.args || ['--check'])];
let fx;

test.before(() => {
  fx = makeFixture();
  // Дни вступления правил — фиксированные: в свежей установке их пишет ruleSince («завтра»), и текст менялся бы каждый день.
  mutator(fx.root).write('.forma/living/checks.json', JSON.stringify(CHECKS_JSON, null, 2) + '\n');
});
test.after(() => { if (fx) fx.cleanup(); });

const shown = (title, r) => `# ${title}\nexit ${r.status}\n${r.out}`;
const lf = (s) => s.split('\r\n').join('\n');

function compare(name, actual) {
  const file = path.join(GOLDEN, name + '.txt');
  if (process.env.UPDATE_GOLDEN) {
    fs.mkdirSync(GOLDEN, { recursive: true });
    fs.writeFileSync(file, actual);
    return;
  }
  assert.ok(fs.existsSync(file), `нет ${name}.txt в test/fixture/golden/ — UPDATE_GOLDEN=1 npm test`);
  assert.equal(actual, lf(fs.readFileSync(file, 'utf8')), `${name}: вывод разошёлся с записанным`);
}

function withCase(cases, fn) {
  const m = mutator(fx.root);
  try {
    for (const c of cases) c.apply(m);
    return fn();
  } finally {
    m.restore();
  }
}

test('чистая фикстура: вывод доски и сверки', () => {
  compare('clean', shown('check-board', run(fx, BOARD)) + shown('sync-engines', run(fx, syncArgs({}))));
});

for (const c of CASES) {
  test(`порча «${c.name}»: вывод как записан`, () => {
    const actual = withCase([c], () => (c.registry === 'board' ? run(fx, BOARD) : run(fx, syncArgs(c))));
    compare(c.name, shown(c.registry === 'board' ? 'check-board' : 'sync-engines', actual));
  });
}

test('все порчи разом: вывод доски и сверки, порядок находок', () => {
  const all = CASES.filter((c) => c.combine !== false);
  const text = withCase(all, () => shown('check-board', run(fx, BOARD))
    + shown('check-board card-001', run(fx, [...BOARD, 'card-001']))
    + shown('sync-engines --diff', run(fx, syncArgs({ args: ['--check', '--diff'] }))));
  compare('combined', text);
});
