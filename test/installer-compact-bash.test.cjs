'use strict';
// Installer: the auto-compact window is offered (250000 by default) and never overrides the human's own value;
// a missing bash is said out loud, since without it no Claude Code hook runs.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'forma.cjs');
const KEY = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW';

function tmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function install(dir, home, args = [], env = {}) {
  const e = { ...process.env, HOME: home, USERPROFILE: home, ...env };
  delete e[KEY];
  const r = spawnSync(process.execPath, [BIN, 'init', '--yes', '--board', 'skip', '--dir', dir, ...args], { encoding: 'utf8', env: e });
  return { ...r, out: r.stdout + r.stderr };
}
const envOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.claude', 'settings.json'), 'utf8')).env || {};
function writeEnv(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ env: { [KEY]: value } }));
}

test('auto-compact: 250000 by default, --compact sets or removes it', () => {
  const dir = tmp('forma-c-'), home = tmp('forma-h-');
  let r = install(dir, home);
  assert.equal(r.status, 0, r.out);
  assert.equal(envOf(dir)[KEY], '250000');
  assert.match(r.out, /auto-compact window: 250000/);
  install(dir, home, ['--compact', '400000']);
  assert.equal(envOf(dir)[KEY], '400000');
  r = install(dir, home, ['--compact', 'off']);
  assert.equal(envOf(dir)[KEY], undefined);
  assert.match(r.out, /Claude Code default/);
  r = install(dir, home, ['--compact', '12']);
  assert.equal(r.status, 2, 'a value that is not a token count is refused');
});

test('auto-compact: an explicit off is remembered by a rerun, even with --yes; a number turns it back on', () => {
  const dir = tmp('forma-c-'), home = tmp('forma-h-');
  install(dir, home, ['--compact', 'off']);
  let r = install(dir, home);
  assert.equal(r.status, 0, r.out);
  assert.equal(envOf(dir)[KEY], undefined, 'the rerun does not set the window again');
  assert.match(r.out, /off \(your earlier choice/);
  r = install(dir, home, ['--compact', '300000']);
  assert.equal(envOf(dir)[KEY], '300000');
  r = install(dir, home);
  assert.equal(envOf(dir)[KEY], '300000', 'a number forgets the remembered off');
});

test("auto-compact: the human's own value is never changed nor shadowed", () => {
  const home = tmp('forma-h-');
  writeEnv(path.join(home, '.claude', 'settings.json'), '500000');
  const dir = tmp('forma-c-');
  writeEnv(path.join(dir, '.claude', 'settings.json'), '200000'); // what older installers wrote unasked
  const r = install(dir, home);
  assert.equal(envOf(dir)[KEY], undefined, 'the old unasked value no longer shadows the user setting');
  assert.match(r.out, /your 500000 \(~\/\.claude\/settings\.json\) — left as is/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8')).env[KEY], '500000');

  const local = tmp('forma-c-');
  writeEnv(path.join(local, '.claude', 'settings.local.json'), '600000');
  install(local, tmp('forma-h-'));
  assert.equal(envOf(local)[KEY], undefined);

  const own = tmp('forma-c-');
  writeEnv(path.join(own, '.claude', 'settings.json'), '300000');
  install(own, tmp('forma-h-'));
  assert.equal(envOf(own)[KEY], '300000', "a project's own value stays");
});

test('no working bash: the installer says the hooks will not run', { skip: process.platform === 'win32' && 'POSIX PATH trick' }, () => {
  const bin = tmp('forma-nobash-');
  for (const t of ['git']) {
    const p = spawnSync('sh', ['-c', `command -v ${t}`], { encoding: 'utf8' }).stdout.trim();
    if (p) fs.symlinkSync(p, path.join(bin, t));
  }
  const r = install(tmp('forma-c-'), tmp('forma-h-'), [], { PATH: bin });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /no working bash found: Claude Code hooks .* will not run/);
  const ok = install(tmp('forma-c-'), tmp('forma-h-'));
  assert.doesNotMatch(ok.out, /no working bash/);
});
