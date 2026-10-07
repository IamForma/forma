'use strict';
// Installer: says which version it installed (fresh / refreshed / updated from an older one) and where the dashboard is;
// --dashboard starts it and prints the real address, --no-dashboard leaves it alone.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'forma.cjs');
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

function tmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function install(dir, home, args = []) {
  const r = spawnSync(process.execPath, [BIN, 'init', '--yes', '--board', 'skip', '--dir', dir, ...args],
    { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
  return { ...r, out: r.stdout + r.stderr };
}
const manifestFile = (dir) => path.join(dir, '.forma', 'install-manifest.json');

test('version line: installed, refreshed, updated', () => {
  const dir = tmp('forma-v-'), home = tmp('forma-h-');
  let r = install(dir, home);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, new RegExp(`✓ Forma ${VERSION.replace(/\./g, '\\.')} installed\\.`));
  r = install(dir, home);
  assert.match(r.out, new RegExp(`Forma ${VERSION.replace(/\./g, '\\.')} — already this version`));
  const m = JSON.parse(fs.readFileSync(manifestFile(dir), 'utf8'));
  m.version = '0.0.1';
  fs.writeFileSync(manifestFile(dir), JSON.stringify(m));
  r = install(dir, home);
  assert.match(r.out, new RegExp(`Forma updated: 0\\.0\\.1 → ${VERSION.replace(/\./g, '\\.')}\\.`));
  assert.equal(JSON.parse(fs.readFileSync(manifestFile(dir), 'utf8')).version, VERSION);
});

test('dashboard: without a terminal the installer prints the start command and does not start it', () => {
  const dir = tmp('forma-d-'), home = tmp('forma-h-');
  const r = install(dir, home);
  assert.match(r.out, /Dashboard: node \.forma\/dashboard\/ensure-running\.js/);
  assert.equal(fs.existsSync(path.join(dir, '.forma', 'dashboard', '.cache', 'server.json')), false);
  const no = install(dir, home, ['--no-dashboard']);
  assert.match(no.out, /Dashboard: node \.forma\/dashboard\/ensure-running\.js/);
});

test('dashboard: --dashboard starts it and prints its address', async () => {
  const dir = tmp('forma-d-'), home = tmp('forma-h-');
  const cache = path.join(dir, '.forma', 'dashboard', '.cache', 'server.json');
  let info = null;
  try {
    const r = install(dir, home, ['--dashboard']);
    assert.equal(r.status, 0, r.out);
    info = JSON.parse(fs.readFileSync(cache, 'utf8'));
    assert.ok(r.out.includes(`Dashboard: ${info.url}`), r.out);
    const res = await fetch(info.url);
    assert.equal(res.status, 200);
  } finally {
    if (info && info.pid) { try { process.kill(info.pid); } catch { /* already gone */ } }
    try { // the supervisor would restart the server: stop it too
      const ps = spawnSync('pkill', ['-f', path.join(dir, '.forma', 'dashboard')]);
      void ps;
    } catch { /* no pkill */ }
  }
});
