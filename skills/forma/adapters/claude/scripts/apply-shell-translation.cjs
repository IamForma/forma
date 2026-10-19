#!/usr/bin/env node
// apply-shell-translation.cjs — orchestrates the file-dependent part of a shell-translation
// rollout: for each file-type target in a map-shell.json (ability "file" or "line-php"),
// and for theme.json (ability "json-pointer"): read live via novamira CLI, back up locally,
// verify against the expected source text, apply via the existing apply-*
// scripts (or translate-blocks-pipeline for "file" html targets), write back via
// novamira CLI, read back and verify no Cyrillic remains.
// node .claude/scripts/apply-shell-translation.cjs --map <map-shell.json> --backup-dir <dir> --work-dir <dir> [--dry-run]
// stdout: one JSON summary {ok, results:[{key,status,detail}]}. Exit 0 all ok, 1 any skipped/failed.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const DRY = argv.includes('--dry-run');
const SITE = require('./site.cjs').siteSlug();
if (!SITE) { console.log(JSON.stringify({ ok: false, error: 'no SITE_SLUG in .env' })); process.exit(2); }

const MAP_FILE = opt('--map');
const BACKUP_DIR = opt('--backup-dir');
const WORK_DIR = opt('--work-dir');
if (!MAP_FILE || !BACKUP_DIR || !WORK_DIR) {
  console.log(JSON.stringify({ ok: false, error: 'usage: --map <map-shell.json> --backup-dir <dir> --work-dir <dir> [--dry-run]' }));
  process.exit(2);
}
const MAP = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const STRINGS = path.join(WORK_DIR, 'strings-shell.json');
const TR = path.join(WORK_DIR, 'tr-shell.json');

function cli(args) {
  const r = spawnSync('novamira', ['--site', SITE, '--json', '--yes', ...args], { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  try { return JSON.parse(r.stdout); } catch { return { ok: false, error: { code: 'cli_output', message: (r.stderr || r.stdout || '').slice(0, 2000) } }; }
}
function runAbility(name, input) {
  const tmp = path.join(os.tmpdir(), `shell-translation-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmp, JSON.stringify(input), 'utf8');
  try { return cli(['run', name, '--input', '@' + tmp]); } finally { fs.unlinkSync(tmp); }
}
function readLive(p) { return runAbility('novamira/read-file', { path: p }); }
function writeLive(p, content) { return runAbility('novamira/write-file', { path: p, content, mode: 'overwrite' }); }
function hasCyrillic(s) { return /[А-Яа-яЁё]/.test(s); }
function runNode(scriptRel, args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, scriptRel), ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let out; try { out = JSON.parse(r.stdout); } catch { out = { ok: false, error: r.stdout + r.stderr }; }
  return { status: r.status, out };
}

const results = [];

for (const [key, entry] of Object.entries(MAP)) {
  const target = entry.target;
  if (entry.note && entry.note.startsWith('HELD BACK')) { results.push({ key, status: 'held-back', detail: entry.note }); continue; }
  if (entry.note && entry.note.includes('0 translatable')) { results.push({ key, status: 'no-op-confirm' }); continue; }
  if (target.ability === 'gutenberg') { results.push({ key, status: 'skip-core-html', detail: 'handled separately, requires human finalizer' }); continue; }

  if (target.ability === 'file') {
    const folder = entry.folder;
    const workDir = path.join(WORK_DIR, folder);
    const outHtml = path.join(workDir, 'out.html');
    const sourceHtml = path.join(workDir, 'source.html');
    if (!fs.existsSync(outHtml)) { results.push({ key, status: 'skip-no-out', detail: 'out.html missing (held back upstream)' }); continue; }
    const live = readLive(target.path);
    if (!live.ok) { results.push({ key, status: 'read-failed', detail: live.error }); continue; }
    const liveContent = live.data.content;
    const expectedSource = fs.readFileSync(sourceHtml, 'utf8');
    if (liveContent !== expectedSource) { results.push({ key, status: 'drift', detail: 'live content does not match the expected source.html — address may have shifted' }); continue; }
    const backupPath = path.join(BACKUP_DIR, 'templates', path.basename(target.path) + '.json');
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, JSON.stringify({ path: target.path, content: liveContent }, null, 1), 'utf8');
    const newContent = fs.readFileSync(outHtml, 'utf8');
    if (hasCyrillic(newContent)) { results.push({ key, status: 'cyrillic-in-out', detail: 'out.html still has Cyrillic, not writing' }); continue; }
    if (DRY) { results.push({ key, status: 'dry-ok', detail: `would write ${target.path}` }); continue; }
    const w = writeLive(target.path, newContent);
    if (!w.ok) { results.push({ key, status: 'write-failed', detail: w.error }); continue; }
    const verify = readLive(target.path);
    const stillCyr = verify.ok && hasCyrillic(verify.data.content);
    results.push({ key, status: stillCyr ? 'written-but-cyrillic' : 'ok', detail: { bytes: w.data.bytes_written } });
    continue;
  }

  if (target.ability === 'json-pointer') {
    const live = readLive(target.path);
    if (!live.ok) { results.push({ key, status: 'read-failed', detail: live.error }); continue; }
    const liveContent = live.data.content;
    const backupPath = path.join(BACKUP_DIR, 'theme-functions', 'theme.json');
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, liveContent, 'utf8');
    const localIn = path.join(os.tmpdir(), `shell-translation-theme-in-${process.pid}.json`);
    const localOut = path.join(os.tmpdir(), `shell-translation-theme-out-${process.pid}.json`);
    fs.writeFileSync(localIn, liveContent, 'utf8');
    const r = runNode('.claude/scripts/apply-json-pointer.cjs', ['--in', localIn, '--strings', STRINGS, '--tr', TR, '--source', 'theme-json', '--out', localOut]);
    if (r.status !== 0) { results.push({ key, status: 'apply-failed', detail: r.out }); fs.unlinkSync(localIn); continue; }
    const newContent = fs.readFileSync(localOut, 'utf8');
    let parsedOk = true; try { JSON.parse(newContent); } catch { parsedOk = false; }
    if (!parsedOk) { results.push({ key, status: 'invalid-json', detail: 'new theme.json does not parse' }); fs.unlinkSync(localIn); fs.unlinkSync(localOut); continue; }
    if (hasCyrillic(newContent)) { results.push({ key, status: 'cyrillic-in-out', detail: 'theme.json still has Cyrillic' }); fs.unlinkSync(localIn); fs.unlinkSync(localOut); continue; }
    if (DRY) { results.push({ key, status: 'dry-ok', detail: `would write ${target.path}`, applied: r.out.applied.length }); fs.unlinkSync(localIn); fs.unlinkSync(localOut); continue; }
    const w = writeLive(target.path, newContent);
    fs.unlinkSync(localIn); fs.unlinkSync(localOut);
    if (!w.ok) { results.push({ key, status: 'write-failed', detail: w.error }); continue; }
    const verify = readLive(target.path);
    const stillCyr = verify.ok && hasCyrillic(verify.data.content);
    let verifyParses = true; try { JSON.parse(verify.data.content); } catch { verifyParses = false; }
    results.push({ key, status: (stillCyr || !verifyParses) ? 'written-but-bad' : 'ok', detail: { bytes: w.data.bytes_written, pointers: r.out.applied.length } });
    continue;
  }

  if (target.ability === 'line-php') {
    const live = readLive(target.path);
    if (!live.ok) { results.push({ key, status: 'read-failed', detail: live.error }); continue; }
    const liveContent = live.data.content;
    const base = path.basename(target.path);
    const backupPath = path.join(BACKUP_DIR, 'theme-functions', base);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, liveContent, 'utf8');
    const localIn = path.join(os.tmpdir(), `shell-translation-${base}-in-${process.pid}.txt`);
    const localOut = path.join(os.tmpdir(), `shell-translation-${base}-out-${process.pid}.txt`);
    fs.writeFileSync(localIn, liveContent, 'utf8');
    const sourceKey = key; // e.g. "functions-php"
    const r = runNode('.claude/scripts/apply-line-strings.cjs', ['--in', localIn, '--strings', STRINGS, '--tr', TR, '--source', sourceKey, '--out', localOut]);
    if (r.status !== 0) { results.push({ key, status: 'apply-failed', detail: r.out }); fs.unlinkSync(localIn); continue; }
    const newContent = fs.readFileSync(localOut, 'utf8');
    if (hasCyrillic(newContent)) { results.push({ key, status: 'cyrillic-in-out', detail: `${base} still has Cyrillic` }); fs.unlinkSync(localIn); fs.unlinkSync(localOut); continue; }
    if (DRY) { results.push({ key, status: 'dry-ok', detail: `would execute-php write ${target.path}`, applied: r.out.applied.length }); fs.unlinkSync(localIn); fs.unlinkSync(localOut); continue; }
    // Write via execute-php (file_put_contents), nowdoc to avoid interpolation.
    const tag = 'C9_' + base.replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
    const php = `$__p = ${JSON.stringify(target.path)};\n$__c = <<<'${tag}'\n${newContent}\n${tag};\n$__r = file_put_contents($__p, $__c);\nreturn ['bytes' => $__r];`;
    const exec = runAbility('novamira/execute-php', { code: php });
    fs.unlinkSync(localIn); fs.unlinkSync(localOut);
    if (!exec.ok || exec.data.success === false) { results.push({ key, status: 'write-failed', detail: exec.error || exec.data.error_message }); continue; }
    // Liveness check: site responds, and another execute-php call succeeds (PHP not fatal).
    const alive = runAbility('novamira/execute-php', { code: "return ['alive' => true, 'home' => home_url('/')];" });
    const verify = readLive(target.path);
    const stillCyr = verify.ok && hasCyrillic(verify.data.content);
    const ok = alive.ok && alive.data.success !== false && !stillCyr;
    results.push({ key, status: ok ? 'ok' : 'written-but-check-failed', detail: { bytes: exec.data.return_value && exec.data.return_value.bytes, alive: alive.ok, phpErrors: (exec.data.errors || []).length } });
    continue;
  }

  results.push({ key, status: 'unknown-ability', detail: target.ability });
}

const ok = results.every((r) => ['ok', 'no-op-confirm', 'held-back', 'skip-core-html', 'dry-ok'].includes(r.status));
console.log(JSON.stringify({ ok, dry_run: DRY, results }, null, 1));
process.exit(ok ? 0 : 1);
