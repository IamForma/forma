// check-release.cjs: сканер порчи переезда ловит образцы и не трогает честные пути; клон протокола чист.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gitRun } = require('../scripts/lib/git.cjs');
const { scanCorruption, RULES } = require('../scripts/check-release.cjs');

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

test('правил порчи не меньше трёх', () => {
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
  assert.equal(scanMessages(['Card ' + '134: grid', 'card-' + '197: set', 'v1 — 20' + '31-01-05', 'Clean message']).length, 2);
});

test('commit messages in Cyrillic are a language finding', () => {
  const bad = scanMessages(['Clean message', 'Чистое сообщение']);
  assert.deepEqual(bad.map((b) => b.rule), ['language']);
});

test('в сам клон протокола следы проекта не просочились', () => {
  const bad = scanTraces(path.join(__dirname, '..'));
  assert.deepEqual(bad.map((b) => `${b.file}:${b.line} ${b.rule}`), []);
});

test('следы проекта: домен, коннектор сайта и число карточек в сообщении', () => {
  const dir = repoWith({
    'a.md': 'on formacraft.studio the site\n',
    'b.md': 'use `mcp__novamira-example-site__execute` here\n',
    'c.md': 'clean line about mcp__site__ connector\n',
  });
  assert.deepEqual([...new Set(scanTraces(dir).map((x) => x.file))].sort(), ['a.md', 'b.md']);
  assert.deepEqual(scanMessages(['Core closed 11 cards', 'Add graph renderer']).map((x) => x.rule), ['card-count']);
});
