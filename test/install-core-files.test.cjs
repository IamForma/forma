'use strict';
// Installer: every core directory the roles call by path lands in the project (the Plumb driver was once left out).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'forma.cjs');
const CORE = path.join(__dirname, '..', 'skills', 'forma', 'core');

test('core/plumb is installed byte-identical into .forma/plumb', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-c-')), home = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-h-'));
  const r = spawnSync(process.execPath, [BIN, 'init', '--yes', '--board', 'skip', '--no-dashboard', '--dir', dir],
    { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const f of fs.readdirSync(path.join(CORE, 'plumb'))) {
    assert.ok(fs.readFileSync(path.join(dir, '.forma', 'plumb', f)).equals(fs.readFileSync(path.join(CORE, 'plumb', f))), f);
  }
});
