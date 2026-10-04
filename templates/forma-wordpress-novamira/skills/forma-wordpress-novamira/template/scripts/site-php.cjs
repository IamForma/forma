#!/usr/bin/env node
// site-php.cjs — a PHP file to the site through the novamira CLI; only a summary to the console (the run-scripts contract).
// node .claude/scripts/site-php.cjs <file.php> --report <path.json> [--write] [--dry-run] [--site <slug>, SITE_SLUG from .env by default]
// node .claude/scripts/site-php.cjs --upload <local> <remote> --report <path.json> --write [--dry-run]
// By default read-only: code with writing calls is rejected (exit 2) until --write.
// The PHP result (return_value, output, errors) goes only to the report. Codes: 0 ok · 1 PHP warnings · 2 stop.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const site = opt('--site', require('./site.cjs').siteSlug());
if (!site) { console.log(JSON.stringify({ status: 'stop', error: 'no SITE_SLUG in .env' })); process.exit(2); }
const report = opt('--report');
const dry = flag('--dry-run');
const write = flag('--write');

const WRITE_RE = /(?:\b|->)(file_put_contents|fwrite|unlink|rename|copy|mkdir|rmdir|touch|update_option|add_option|delete_option|update_post_meta|add_post_meta|delete_post_meta|wp_insert_\w+|wp_update_\w+|wp_delete_\w+|writeAll|query|insert|update|delete|replace|move_uploaded_file|exec|shell_exec|system|passthru|proc_open)\s*\(/;

function finish(status, extra, details) {
  if (!report) { console.log(JSON.stringify({ status: 'stop', error: '--report is required' })); process.exit(2); }
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(report, JSON.stringify(details, null, 1), 'utf8');
  console.log(JSON.stringify({ status, done: status === 'stop' ? 0 : 1, left: status === 'stop' ? 1 : 0, report, dry_run: dry, ...extra }));
  process.exit({ ok: 0, work: 1, stop: 2 }[status]);
}

function cli(args) {
  const r = spawnSync('novamira', ['--site', site, '--json', '--yes', ...args], { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  try { return JSON.parse(r.stdout); } catch { return { ok: false, error: { code: 'cli_output', message: (r.stderr || r.stdout || '').slice(0, 2000) } }; }
}

const upIdx = argv.indexOf('--upload');
if (upIdx >= 0) {
  const local = argv[upIdx + 1], remote = argv[upIdx + 2];
  if (!local || !remote || !fs.existsSync(local)) finish('stop', { error: 'no local file or path' }, { local, remote });
  const size = fs.statSync(local).size;
  if (!write) finish('stop', { error: 'an upload is a write; --write is needed' }, { local, remote, size });
  if (dry) finish('ok', { would: 'upload', size }, { local, remote, size });
  const r = cli(['upload', local, remote]);
  finish(r.ok ? 'ok' : 'stop', { size }, { local, remote, size, cli: r });
}

const file = argv.find((a) => !a.startsWith('--') && a.endsWith('.php'));
if (!file || !fs.existsSync(file)) finish('stop', { error: 'no .php file' }, { file });
const code = fs.readFileSync(file, 'utf8').replace(/^\s*<\?php\s*/, '');
const hit = code.match(WRITE_RE);
if (hit && !write) finish('stop', { error: `writing call «${hit[1]}» without --write` }, { file, hit: hit[0] });
if (dry) finish('ok', { would: 'execute-php', bytes: code.length, write }, { file, bytes: code.length, write_call: hit && hit[1] });

const tmp = path.join(os.tmpdir(), `site-php-${process.pid}.json`);
fs.writeFileSync(tmp, JSON.stringify({ code }), 'utf8');
const r = cli(['run', 'novamira/execute-php', '--input', '@' + tmp]);
fs.unlinkSync(tmp);
const d = (r && r.data) || {};
const errs = (d.errors || []).length;
const status = !r.ok || d.success === false ? 'stop' : errs ? 'work' : 'ok';
finish(status, { php_errors: errs, ms: d.execution_time_ms }, { file, cli: r });
