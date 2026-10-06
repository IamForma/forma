// Фиксаторы поведения движка на учебном проекте-фикстуре (test/fixture/overlay/).
// Страховочная сетка серии рефакторинга: поведение до и после каждой итерации одно и то же.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture } = require('./helpers/fixture.cjs');
const { snapshot } = require('./helpers/snapshot.cjs');
const { run, newCardDry, collect } = require('./helpers/outputs.cjs');

const BASELINE = path.join(__dirname, '.baseline');
let fx;

test.before(() => { fx = makeFixture(); });
test.after(() => { if (fx) fx.cleanup(); });

test('buildData: два прогона подряд дают один снимок', () => {
  const a = snapshot(fx);
  const b = snapshot(fx);
  assert.equal(a, b);
  const data = JSON.parse(a);
  assert.equal(data.totals.cardCount, 3, 'в фикстуре три карточки');
});

test('check-board: фикстура без порчи — чисто', () => {
  const r = run(fx, ['.forma/board/check-board.cjs']);
  assert.equal(r.status, 0, r.out);
  assert.equal(r.out.trim(), '');
});

test('check-board: порча фикстуры (убрано поле epic) — падает', () => {
  const card = path.join(fx.root, '.devtool', 'features', 'card-001-nastroit-sborku-primera.md');
  const orig = fs.readFileSync(card, 'utf8');
  try {
    fs.writeFileSync(card, orig.replace(/^epic:.*\r?\n/m, ''));
    const r = run(fx, ['.forma/board/check-board.cjs']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /card-001-nastroit-sborku-primera\.md: карточка без эпика/);
  } finally {
    fs.writeFileSync(card, orig);
  }
  assert.equal(run(fx, ['.forma/board/check-board.cjs']).status, 0, 'после восстановления снова чисто');
});

test('new-card --dry: следующий номер, эпик и метки из PROJECT.md, файл не пишется', () => {
  const before = fs.readdirSync(path.join(fx.root, '.devtool', 'features')).sort();
  const r = newCardDry(fx);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /<ROOT>\/\.devtool\/features\/card-004-proba-setki\.md/);
  assert.match(r.out, /^epic: "3\. Form\/Intent\+Kit"$/m);
  assert.match(r.out, /^labels: \["goal-forma", "route-4"\]$/m);
  assert.match(r.out, /^## Task$/m);
  assert.deepEqual(fs.readdirSync(path.join(fx.root, '.devtool', 'features')).sort(), before);
});

test('sync-engines --check: чистая установка с фикстурой — зелёная', () => {
  const r = run(fx, ['.claude/scripts/sync-engines.cjs', '--check']);
  assert.equal(r.status, 0, r.out.slice(-3000));
  assert.match(r.out, /Закон, ядро и готовые адаптеры в порядке\./);
});

test('тесты экономики и соответствия адаптера — в установленном проекте', () => {
  for (const file of ['.forma/dashboard/economy.test.cjs', '.forma/dashboard/i18n.test.cjs', '.claude/scripts/claude-economy.test.cjs', '.claude/scripts/forma-adapter.test.cjs']) {
    const r = run(fx, [file]);
    assert.equal(r.status, 0, `${file}:\n${r.out.slice(-3000)}`);
  }
});

test('совпадение с точкой отсчёта test/.baseline/ (если записана)', (t) => {
  if (!fs.existsSync(BASELINE)) { t.skip('нет test/.baseline/ — node test/baseline.cjs save'); return; }
  const now = collect(fx);
  for (const [name, text] of Object.entries(now)) {
    const file = path.join(BASELINE, name);
    assert.ok(fs.existsSync(file), `нет ${name} в test/.baseline/`);
    assert.equal(text, fs.readFileSync(file, 'utf8'), `${name} разошёлся с точкой отсчёта`);
  }
});
