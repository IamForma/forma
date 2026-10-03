// layout-roots.cjs: поиск __dirname-корней, новая глубина по --delta.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitRun } = require('../scripts/lib/git.cjs');

const ROOTS = path.join(__dirname, '..', 'scripts', 'layout', 'layout-roots.cjs');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-roots-'));
  const g = (...a) => gitRun(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a);
  assert.equal(gitRun(dir, 'init', '-q').code, 0);
  fs.writeFileSync(path.join(dir, 'a.cjs'),
    "const x = path.resolve(__dirname, '..');\nconst y = path.join(__dirname, '..', '..');\n");
  g('add', '-A');
  assert.equal(g('commit', '-q', '-m', 'init').code, 0);
  return dir;
}

function run(dir, args) { return spawnSync(process.execPath, [ROOTS, ...args], { cwd: dir, encoding: 'utf8' }); }

let dir;
test.before(() => { dir = makeRepo(); });
test.after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

test('--help', () => { assert.equal(run(dir, ['--help']).status, 0); });

test('без --delta: список мест с адресами и числом «..»', () => {
  const r = run(dir, []);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /a\.cjs:1: path\.resolve\(__dirname, \.\.\.\) — 1 '\.\.'/);
  assert.match(r.stdout, /a\.cjs:2: path\.join\(__dirname, \.\.\.\) — 2 '\.\.'/);
  assert.doesNotMatch(r.stdout, /новое число/);
});

test('--delta 1: печатает новое число «..»', () => {
  const r = run(dir, ['--delta', '1']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /— 1 '\.\.' → новое число: 2/);
  assert.match(r.stdout, /— 2 '\.\.' → новое число: 3/);
});

test('пустое дерево: сообщение, код 0', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-roots-empty-'));
  gitRun(empty, 'init', '-q');
  const r = run(empty, []);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /не найдено/);
  fs.rmSync(empty, { recursive: true, force: true });
});
