'use strict';
// Downgrade guard: the installer refuses to roll back a project whose installed version or protocol clone is newer.
// The protocol line is compared first (numbering was once reset), semver only within one line.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'forma.cjs');
const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

function tmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function install(dir, home, args = []) {
  const r = spawnSync(process.execPath, [BIN, 'init', '--yes', '--board', 'skip', '--no-dashboard', '--dir', dir, ...args],
    { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } });
  return { ...r, out: r.stdout + r.stderr };
}
const manifestFile = (dir) => path.join(dir, '.forma', 'install-manifest.json');
function patchManifest(dir, patch) {
  const m = JSON.parse(fs.readFileSync(manifestFile(dir), 'utf8'));
  for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete m[k]; else m[k] = v; }
  fs.writeFileSync(manifestFile(dir), JSON.stringify(m));
}
function fresh() {
  const dir = tmp('forma-g-'), home = tmp('forma-h-');
  const r = install(dir, home);
  assert.equal(r.status, 0, r.out);
  return { dir, home };
}

test('the manifest records the protocol line', () => {
  const { dir } = fresh();
  assert.equal(JSON.parse(fs.readFileSync(manifestFile(dir), 'utf8')).line, PKG.line);
});

test('refuses when the installed version is on a newer line', () => {
  const { dir, home } = fresh();
  patchManifest(dir, { line: PKG.line + 1 });
  const r = install(dir, home);
  assert.equal(r.status, 3, r.out);
  assert.match(r.out, /Refusing to install/);
  assert.equal(JSON.parse(fs.readFileSync(manifestFile(dir), 'utf8')).line, PKG.line + 1, 'the manifest is untouched');
});

test('refuses when the installed version is newer within the same line', () => {
  const { dir, home } = fresh();
  patchManifest(dir, { version: '99.0.0' });
  const r = install(dir, home);
  assert.equal(r.status, 3, r.out);
});

test('an older-looking semver on an older line (numbering reset) is not a block', () => {
  const { dir, home } = fresh();
  patchManifest(dir, { version: '0.4.206-alpha', line: undefined });
  const r = install(dir, home);
  assert.equal(r.status, 0, r.out);
  assert.equal(JSON.parse(fs.readFileSync(manifestFile(dir), 'utf8')).version, PKG.version);
});

test('--allow-downgrade installs anyway and says so', () => {
  const { dir, home } = fresh();
  patchManifest(dir, { version: '99.0.0' });
  const r = install(dir, home, ['--allow-downgrade']);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /--allow-downgrade/);
  assert.equal(JSON.parse(fs.readFileSync(manifestFile(dir), 'utf8')).version, PKG.version);
});

test('refuses when the project has a newer protocol clone and names the command from the clone', () => {
  const { dir, home } = fresh();
  const clone = path.join(dir, '.forma', 'protocol');
  fs.mkdirSync(clone, { recursive: true });
  fs.writeFileSync(path.join(clone, 'package.json'), JSON.stringify({ version: '0.0.1', line: PKG.line + 1 }));
  const r = install(dir, home);
  assert.equal(r.status, 3, r.out);
  assert.match(r.out, /\.forma\/protocol/);
  assert.match(r.out, /node \.forma\/protocol\/bin\/forma\.cjs init/);
});

test('a clone that is not newer does not block', () => {
  const { dir, home } = fresh();
  const clone = path.join(dir, '.forma', 'protocol');
  fs.mkdirSync(clone, { recursive: true });
  fs.writeFileSync(path.join(clone, 'package.json'), JSON.stringify({ version: PKG.version, line: PKG.line }));
  const r = install(dir, home);
  assert.equal(r.status, 0, r.out);
});
