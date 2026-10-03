// layout-verify.cjs: одна проверка, код ≠0 при провале, не больше 30 строк.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitRun } = require('../scripts/lib/git.cjs');

const VERIFY = path.join(__dirname, '..', 'scripts', 'layout', 'layout-verify.cjs');
const MAP = path.join(__dirname, '..', 'scripts', 'layout', 'layout-map.json');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-verify-'));
  const g = (...a) => gitRun(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a);
  assert.equal(gitRun(dir, 'init', '-q').code, 0);
  fs.mkdirSync(path.join(dir, 'board'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'board', 'check-board.cjs'), 'process.exit(0);\n');
  fs.mkdirSync(path.join(dir, 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dashboard', 'generate.js'), 'process.exit(0);\n');
  fs.mkdirSync(path.join(dir, '.claude', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'scripts', 'sync-engines.cjs'), 'process.exit(0);\n');
  fs.mkdirSync(path.join(dir, 'protocol'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'protocol', 'package.json'), JSON.stringify({ scripts: { test: 'node -e "process.exit(0)"' } }));
  fs.writeFileSync(path.join(dir, 'clean.md'), 'ничего старого тут нет\n');
  g('add', '-A');
  assert.equal(g('commit', '-q', '-m', 'init').code, 0);
  return dir;
}

function run(dir, args) { return spawnSync(process.execPath, [VERIFY, ...args], { cwd: dir, encoding: 'utf8', timeout: 60000 }); }

let dir;
test.before(() => { dir = makeRepo(); });
test.after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

test('--help', () => { assert.equal(run(dir, ['--help']).status, 0); });

test('всё зелёное: код 0, пять строк ✓', () => {
  const r = run(dir, ['--map', MAP]);
  assert.equal(r.status, 0);
  const lines = r.stdout.trim().split('\n');
  assert.ok(lines.length <= 30);
  assert.ok(lines.every((l) => l.startsWith('✓')));
});

test('старый путь вне исключений: код ≠0, провал назван', () => {
  fs.writeFileSync(path.join(dir, 'leftover.md'), 'читай `dashboard/generate.js`\n');
  const r = run(dir, ['--map', MAP]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /✗ старые пути вне исключений/);
  fs.rmSync(path.join(dir, 'leftover.md'));
});

test('упавшая проверка (check-board) — провал по имени, не больше 30 строк', () => {
  const original = fs.readFileSync(path.join(dir, 'board', 'check-board.cjs'), 'utf8');
  fs.writeFileSync(path.join(dir, 'board', 'check-board.cjs'), 'process.exit(1);\n');
  const r = run(dir, ['--map', MAP]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /✗ check-board/);
  assert.ok(r.stdout.trim().split('\n').length <= 30);
  fs.writeFileSync(path.join(dir, 'board', 'check-board.cjs'), original);
});

test('--map без аргумента — ошибка, код ≠0', () => {
  assert.notEqual(run(dir, []).status, 0);
});

// уже верная относительная ссылка между соседями и текст самой таблицы
// переезда не считаются «старыми путями».
test('верная соседская ссылка и текст таблицы — не ложные «старые пути»', () => {
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-verify-neigh-'));
  const g = (...a) => gitRun(dir2, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a);
  assert.equal(gitRun(dir2, 'init', '-q').code, 0);
  fs.mkdirSync(path.join(dir2, 'board'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'board', 'check-board.cjs'), 'process.exit(0);\n');
  fs.writeFileSync(path.join(dir2, 'board', 'x.cjs'), "require('../dashboard/floor.cjs');\n"); // верный сосед
  fs.mkdirSync(path.join(dir2, 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'dashboard', 'generate.js'), 'process.exit(0);\n');
  fs.writeFileSync(path.join(dir2, 'dashboard', 'floor.cjs'), 'module.exports = {};\n');
  fs.mkdirSync(path.join(dir2, '.claude', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir2, '.claude', 'scripts', 'sync-engines.cjs'), 'process.exit(0);\n');
  fs.mkdirSync(path.join(dir2, 'protocol'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'protocol', 'package.json'), JSON.stringify({ scripts: { test: 'node -e "process.exit(0)"' } }));
  // копия таблицы переезда рядом, лежит внутри дерева, которое обходится --root
  const mapCopy = { moves: [{ from: 'board', to: '.forma/board' }, { from: 'dashboard', to: '.forma/dashboard' }], exceptions: {} };
  fs.writeFileSync(path.join(dir2, 'my-map.json'), JSON.stringify(mapCopy, null, 2) + '\n');
  g('add', '-A'); assert.equal(g('commit', '-q', '-m', 'init').code, 0);
  const r = run(dir2, ['--map', path.join(dir2, 'my-map.json')]);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().split('\n').every((l) => l.startsWith('✓')), r.stdout);
  fs.rmSync(dir2, { recursive: true, force: true });
});
