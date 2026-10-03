// check-release.cjs: сканер порчи переезда ловит образцы и не трогает честные пути; клон протокола чист.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gitRun } = require('../scripts/lib/git.cjs');
const { scanCorruption, RULES } = require('../scripts/check-release.cjs');
const { findMatches } = require('../scripts/layout/lib.cjs');

const R = '.' + 'forma/'; // не литерал целиком — чтобы сканер не краснел на собственном тесте

function repoWith(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
  gitRun(dir, 'init', '-q');
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); }
  gitRun(dir, 'add', '-A');
  return dir;
}

test('сканер ловит три вида порчи', () => {
  const dir = repoWith({
    'a.md': `см. github.com/mattpocock/${R}skills\n`,
    'b.md': `путь ${R}protocol/${R}skills/forma/\n`,
    'c.md': `ключ \`${R}skills:\` и ${R}dashboard's\n`,
    'd.md': `site pages/${R}templates/blocks\n`,
  });
  assert.deepEqual([...new Set(scanCorruption(dir).map((x) => x.file))].sort(), ['a.md', 'b.md', 'c.md', 'd.md']);
});

test('сканер не трогает честные пути', () => {
  const dir = repoWith({ 'ok.md': `\`${R}skills/forma/SKILL.md\`, \`${R}manual/\`, ../${R}board/x, node ${R}board/new-card.cjs\n` });
  assert.deepEqual(scanCorruption(dir), []);
});

test('в сам клон протокола порча не просочилась', () => {
  const bad = scanCorruption(path.join(__dirname, '..'));
  assert.deepEqual(bad.map((b) => `${b.file}:${b.line} ${b.rule}`), []);
});

test('layout-rewrite: слово в прозе, чужой путь и ключ — спорные, настоящие пути — точные', () => {
  const mv = { from: 'skills', to: R + 'skills' };
  const certain = (t) => findMatches(t, mv, [], {}).map((m) => m.certain);
  assert.deepEqual(certain('github.com/mattpocock/skills'), [false]);
  assert.deepEqual(certain('pages/templates/blocks'.replace('templates', 'skills')), [false]);
  assert.deepEqual(certain('what skills/tools/connectors'), [false]);
  assert.deepEqual(certain('ключ `skills:` в frontmatter'), [false]);
  assert.deepEqual(certain('читай `skills/forma/SKILL.md`'), [true]);
  assert.deepEqual(certain('npm --prefix skills'), [true]);
  assert.ok(RULES.length >= 3);
});

const { scanTraces, scanMessages } = require('../scripts/check-release.cjs');

test('следы проекта в файлах: код и номер карточки, попытка, критерий, дата, имя сайта', () => {
  const dir = repoWith({
    'a.cjs': '// ' + 'card-' + '123\n',
    'b.md': 'см. ' + 'Карточка ' + '45\n',
    'c.cjs': '// ' + 'попытка ' + '2\n',
    'd.md': '' + 'критерий ' + '3\n',
    'e.md': 'обновлено 20' + '31-01-05\n',
    'f.md': 'сайт iamforma' + '.pro\n',
    'g.cjs': '// ' + 'goal-' + '12\n',
  });
  assert.deepEqual([...new Set(scanTraces(dir).map((x) => x.file))].sort(), ['a.cjs', 'b.md', 'c.cjs', 'd.md', 'e.md', 'f.md', 'g.cjs']);
});

test('заглушки card-001…009, card-099, goal-00 и даты в test/ — не след', () => {
  const dir = repoWith({
    'a.md': 'card-001-x, card-099, goal-00, goal-01\n',
    'test/t.cjs': "// created: '20" + "31-01-05'\n",
  });
  assert.deepEqual(scanTraces(dir), []);
});

test('следы проекта в сообщениях коммитов; дата в сообщении допустима', () => {
  assert.equal(scanMessages(['Карточка ' + '134: сетка', 'card-' + '197: набор', 'v1 — 20' + '31-01-05', 'Чистое сообщение']).length, 2);
});

test('в сам клон протокола следы проекта не просочились', () => {
  const bad = scanTraces(path.join(__dirname, '..'));
  assert.deepEqual(bad.map((b) => `${b.file}:${b.line} ${b.rule}`), []);
});
