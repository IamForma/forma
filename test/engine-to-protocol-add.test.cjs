// engine-to-protocol.cjs: --apply <файл> --add <тот же файл> переносит новый файл; без --add — отказ;
// --add вне MAP / слой 4 / не из списка новых — отказ до любой записи.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'engine-to-protocol.cjs');
const NEW = '.forma/board/fresh-tool.cjs';
const DST = ['.forma', 'protocol', 'skills', 'forma', 'core', 'board', 'fresh-tool.cjs'];

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2p-add-'));
  const put = (rel, text) => { const f = path.join(dir, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  fs.mkdirSync(path.join(dir, '.forma', 'protocol', '.git'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.forma', 'protocol', 'skills', 'forma', 'core'), { recursive: true });
  put('.forma/protocol/skills/forma/adapters/claude/scripts/known.cjs', 'known\n');
  put('.claude/scripts/known.cjs', 'known\n');
  put(NEW, 'fresh\n');
  put('.claude/project-layer.txt', '.claude/scripts/own-layer.cjs\n');
  put('.claude/scripts/own-layer.cjs', 'own\n');
  put('outside/map.txt', 'x\n');
  put('project/config/X.md', 'x\n');
  return dir;
}
const run = (dir, ...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: dir, encoding: 'utf8' });
const dst = (dir) => path.join(dir, ...DST);

test('--apply F --add F записывает новый файл в шаблон', () => {
  const dir = fixture();
  try {
    const r = run(dir, '--apply', NEW, '--add', NEW);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(dst(dir), 'utf8'), 'fresh\n');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('--apply F без --add отказывает «новый файл: переносится по --add», ничего не записано', () => {
  const dir = fixture();
  try {
    const r = run(dir, '--apply', NEW);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /новый файл: переносится по --add/);
    assert.equal(fs.existsSync(dst(dir)), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('--add для файла вне MAP, слоя 4 или не из списка новых отказывает до записи', () => {
  for (const bad of ['outside/map.txt', '.claude/scripts/own-layer.cjs', 'project/config/X.md', '.claude/scripts/known.cjs']) {
    const dir = fixture();
    try {
      const r = run(dir, '--apply', NEW, '--add', NEW, '--add', bad);
      assert.equal(r.status, 1, bad + ': ' + r.stderr);
      assert.match(r.stderr, /--add (отказан|не из списка новых)/, bad);
      assert.equal(fs.existsSync(dst(dir)), false, bad);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
