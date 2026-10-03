// layout-snapshot.cjs: числа до/после (карточки, страницы документации, скиллы, корень).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SNAPSHOT = path.join(__dirname, '..', 'scripts', 'layout', 'layout-snapshot.cjs');

function run(dir, args) { return spawnSync(process.execPath, [SNAPSHOT, ...args], { cwd: dir, encoding: 'utf8' }); }

let dir;
test.before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-snapshot-'));
  fs.mkdirSync(path.join(dir, '.devtool', 'features'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.devtool', 'features', 'card-001.md'), '# c\n');
  fs.mkdirSync(path.join(dir, 'manual', 'ru'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'manual', 'ru', 'page.md'), '# p\n');
  fs.mkdirSync(path.join(dir, 'skills', 'grilling'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skills', 'grilling', 'SKILL.md'), '# s\n');
});
test.after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

test('--help и без аргументов', () => {
  assert.equal(run(dir, ['--help']).status, 0);
  assert.notEqual(run(dir, []).status, 0);
});

test('snapshot: пишет JSON и печатает числа', () => {
  const out = path.join(dir, 'before.json');
  const r = run(dir, ['snapshot', '--root', dir, '--out', out]);
  assert.equal(r.status, 0);
  const snap = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(snap.cards, 1);
  assert.equal(snap.docPages, 1);
  assert.equal(snap.skills, 1);
  assert.match(r.stdout, /карточек 1, страниц документации 1, скиллов 1/);
});

test('diff: разница между до/после', () => {
  const before = path.join(dir, 'before.json'), after = path.join(dir, 'after.json');
  run(dir, ['snapshot', '--root', dir, '--out', before]);
  fs.writeFileSync(path.join(dir, '.devtool', 'features', 'card-002.md'), '# c2\n');
  run(dir, ['snapshot', '--root', dir, '--out', after]);
  const r = run(dir, ['diff', before, after]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /cards: 1 → 2 \(\+1\)/);
  assert.match(r.stdout, /docPages: 1 → 1 \(=\)/);
});

test('snapshot без --out — ошибка, код ≠0', () => {
  assert.notEqual(run(dir, ['snapshot', '--root', dir]).status, 0);
});
