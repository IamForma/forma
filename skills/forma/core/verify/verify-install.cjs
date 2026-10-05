#!/usr/bin/env node
'use strict';

// Forma install integrity: is everything the installer put down present and wired together.
//   node .forma/verify/verify-install.cjs [--root <folder>] [--json] [--skip-behavior]
// Exit 0 — everything matches (secondary engines may only warn); 1 — a main engine is red.
//
// Three layers; every discrepancy is "address — expected — found" (prohibition 13 of AGENTS.md):
//   1. Manifest — `.forma/install-manifest.json`: sha256 of the files the installer wrote; for human zones
//      (`project/`) — the skeleton (heading counts), not a hash: people fill those in.
//   2. Closure — every .cjs parses, every .json reads; the engine profile checks the wiring
//      (hooks ↔ files ↔ settings, roles, bare-name references).
//   3. Behavior — the engine profile runs the start-up checks (no model call).
// The engine profile lives in the adapter and is named in the manifest (`engines[].profile`); the core does not know engines by name.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const MANIFEST = path.join('.forma', 'install-manifest.json');
const MANIFEST_VERSION = 1;

/** sha256 with normalized line endings: a git checkout on Windows must not turn it red. */
function sha256(file) {
  const buf = fs.readFileSync(file);
  const norm = buf.includes(13) ? Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1') : buf;
  return crypto.createHash('sha256').update(norm).digest('hex');
}

/** Markdown skeleton: count of `#` and `##` headings outside code blocks. Independent of the text language. */
function skeletonOf(text) {
  let fence = false, h1 = 0, h2 = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/^(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    if (/^# /.test(line)) h1++;
    else if (/^## /.test(line)) h2++;
  }
  return { h1, h2 };
}

const rel = (root, abs) => path.relative(root, abs).split(path.sep).join('/');
const isHumanZone = (r) => /^(project|\.devtool)\//.test(r) || r.startsWith('.forma/living/') || r === '.gitignore'
  || r === '.forma/dashboard/graphify.config.json' || r === MANIFEST.split(path.sep).join('/');

/**
 * Install manifest. `owned` — absolute paths the installer wrote in this pass.
 * Non-`project/` files get a hash; `project/*.md` — a skeleton; the rest — presence only.
 * `previous` — the earlier manifest: the `project/` skeleton is not recomputed when the folder already existed.
 */
function buildManifest(root, { owned, projectCreated, previous, engines, lang, version, template }) {
  const files = {};
  // config and service files moved from project/ to project/config/ and project/ops/ — the earlier manifest follows the files
  const moved = (k) => k.replace(/^project\/(PROJECT|CONFIG|SETUP|ROUTE|SITE)\.md$/, 'project/config/$1.md');
  const skeleton = projectCreated || !previous ? {} : Object.fromEntries(Object.entries(previous.skeleton || {}).map(([k, v]) => [moved(k), v]));
  for (const abs of owned) {
    if (!fs.existsSync(abs)) continue;
    const r = rel(root, abs);
    if (r.startsWith('project/')) {
      if (projectCreated) skeleton[r] = /\.md$/.test(r) ? skeletonOf(fs.readFileSync(abs, 'utf8')) : {};
    } else if (!isHumanZone(r)) files[r] = sha256(abs);
  }
  return {
    manifestVersion: MANIFEST_VERSION,
    version,
    lang,
    template: template || 'none',
    engines,
    dirs: ['project', '.forma/living', '.devtool/features'],
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
    skeleton: Object.fromEntries(Object.entries(skeleton).sort(([a], [b]) => a.localeCompare(b))),
  };
}

function readManifest(root) {
  const f = path.join(root, MANIFEST);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

/** .cjs syntax without running it: the body is wrapped the way the CommonJS loader does. */
function syntaxError(file) {
  const src = fs.readFileSync(file, 'utf8').replace(/^#!.*/, '');
  try { new vm.Script('(function (exports, require, module, __filename, __dirname) {' + src + '\n})', { filename: file }); return null; }
  catch (e) { return String(e.message).split('\n')[0]; }
}

const finding = (address, expected, found) => ({ address, expected, found });

/** Layer 1 + core closure: manifest, hashes, skeleton, syntax, JSON. */
function checkCore(root, manifest) {
  const out = [];
  if (!fs.existsSync(path.join(root, 'AGENTS.md'))) out.push(finding('AGENTS.md', 'protocol root law', 'file missing'));
  for (const d of manifest.dirs || []) {
    if (!fs.existsSync(path.join(root, d))) out.push(finding(d + '/', 'directory exists', 'directory missing'));
  }
  for (const [r, want] of Object.entries(manifest.files || {})) {
    const f = path.join(root, r);
    if (!fs.existsSync(f)) { out.push(finding(r, 'installer file', 'file missing')); continue; }
    const got = sha256(f);
    if (got !== want) out.push(finding(r, 'sha256 ' + want.slice(0, 12) + '…', 'sha256 ' + got.slice(0, 12) + '… (file changed after install)'));
    if (/\.cjs$/.test(r)) { const e = syntaxError(f); if (e) out.push(finding(r, 'parses as CommonJS', e)); }
    else if (/\.json$/.test(r)) { try { JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { out.push(finding(r, 'valid JSON', e.message)); } }
  }
  for (const [r, want] of Object.entries(manifest.skeleton || {})) {
    const f = path.join(root, r);
    if (!fs.existsSync(f)) { out.push(finding(r, 'project/ scaffold file', 'file missing')); continue; }
    if (!/\.md$/.test(r)) continue;
    const got = skeletonOf(fs.readFileSync(f, 'utf8'));
    if (got.h1 < want.h1) out.push(finding(r + ' — «#» headings', '≥ ' + want.h1, String(got.h1)));
    if (got.h2 < want.h2) out.push(finding(r + ' — «##» headings', '≥ ' + want.h2, String(got.h2)));
  }
  return out;
}

/** Engine profile from the manifest: an adapter file with `check(ctx)`. No file — not installed (red for a ready engine). */
function loadProfile(root, engine) {
  if (!engine.profile) return { status: 'not-installed', why: engine.note || 'no verify profile declared — adapter not ready' };
  const f = path.join(root, engine.profile);
  if (!fs.existsSync(f)) return { status: 'missing', file: engine.profile };
  try { return { status: 'ok', profile: require(f) }; }
  catch (e) { return { status: 'broken', file: engine.profile, why: e.message.split('\n')[0] }; }
}

/** Full verification. Returns { main, engines:[{id, role, notes, findings}], core, ok }. */
function verify(root, { behavior = true } = {}) {
  root = path.resolve(root);
  const result = { root, ok: true, core: [], engines: [] };
  let manifest;
  try { manifest = readManifest(root); }
  catch (e) { result.core.push(finding(MANIFEST.split(path.sep).join('/'), 'readable JSON', e.message)); result.ok = false; return result; }
  if (!manifest) {
    result.core.push(finding(MANIFEST.split(path.sep).join('/'), 'install manifest', 'file missing — install has no manifest; rerun the installer'));
    result.ok = false;
    return result;
  }
  result.manifest = { version: manifest.version, lang: manifest.lang, template: manifest.template };
  result.core = checkCore(root, manifest);
  if (result.core.length) result.ok = false;

  const engines = manifest.engines || [];
  engines.forEach((engine, i) => {
    const role = i === 0 ? 'main' : 'secondary';
    const row = { id: engine.id, role, notes: [], findings: [] };
    const loaded = loadProfile(root, engine);
    if (loaded.status === 'not-installed') row.notes.push('not installed: ' + loaded.why);
    else if (loaded.status !== 'ok') row.findings.push(finding(loaded.file, 'engine verify profile', loaded.status === 'missing' ? 'file missing' : loaded.why));
    else {
      const ctx = { root, engine, manifest, behavior, finding, syntaxError, mainFindings: result.engines[0] ? result.engines[0].findings : [] };
      try { row.findings.push(...loaded.profile.check(ctx)); }
      catch (e) { row.findings.push(finding(engine.profile, 'profile ran cleanly', e.message.split('\n')[0])); }
    }
    if (role === 'main' && row.findings.length) result.ok = false;
    result.engines.push(row);
  });
  if (!engines.length) { result.core.push(finding('install-manifest.json — engines', 'at least one main engine', 'list is empty')); result.ok = false; }
  return result;
}

/** Text form: OK or a list of "address — expected — found". */
function format(result) {
  const lines = [];
  const row = (f) => `  — ${f.address} — expected: ${f.expected} — found: ${f.found}`;
  for (const f of result.core) lines.push(row(f));
  for (const e of result.engines) {
    const tag = e.role === 'main' ? 'main' : 'secondary';
    for (const n of e.notes) lines.push(`  · ${e.id} (${tag}): ${n}`);
    for (const f of e.findings) lines.push(e.role === 'main' ? row(f) : row(f).replace('  — ', '  ! warning: '));
  }
  const head = result.ok ? '✓ install is intact' : '✗ install is broken';
  return head + (lines.length ? '\n' + lines.join('\n') : '');
}

function main(argv) {
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const root = get('--root') || process.cwd();
  const result = verify(root, { behavior: !argv.includes('--skip-behavior') });
  if (argv.includes('--json')) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(format(result) + '\n');
  process.exit(result.ok ? 0 : 1);
}

module.exports = { MANIFEST, sha256, skeletonOf, buildManifest, readManifest, verify, format, syntaxError };
if (require.main === module) main(process.argv.slice(2));
