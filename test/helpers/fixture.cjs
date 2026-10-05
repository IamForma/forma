// Учебный проект-фикстура: чистая установка протокола (bin/forma.cjs init) во временный каталог
// + синтетические карточки из test/fixture/overlay/. Никаких следов реального проекта.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PKG = path.resolve(__dirname, '..', '..');
const OVERLAY = path.join(PKG, 'test', 'fixture', 'overlay');

function copyTree(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyTree(s, d); } else fs.copyFileSync(s, d);
  }
}

// Изолированный HOME: сборка не видит ~/.claude и ~/.claude.json машины.
function isolatedEnv(home) {
  return { ...process.env, HOME: home, USERPROFILE: home, HOMEDRIVE: '', HOMEPATH: '' };
}

function makeFixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-fixture-'));
  const root = path.join(base, 'project');
  const home = path.join(base, 'home');
  fs.mkdirSync(home);
  const r = spawnSync(process.execPath, [path.join(PKG, 'bin', 'forma.cjs'), 'init', '--dir', root,
    '--engines', 'claude', '--template', 'none', '--board', 'skip', '--yes'],
  { encoding: 'utf8', env: isolatedEnv(home) });
  if (r.status !== 0) throw new Error('forma init упал:\n' + r.stdout + r.stderr);
  copyTree(OVERLAY, root);
  return { base, root, home, env: isolatedEnv(home), cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

function runNode(fx, args) {
  return spawnSync(process.execPath, args, { cwd: fx.root, encoding: 'utf8', env: fx.env, timeout: 120000, maxBuffer: 1 << 28 });
}

module.exports = { PKG, makeFixture, runNode };
