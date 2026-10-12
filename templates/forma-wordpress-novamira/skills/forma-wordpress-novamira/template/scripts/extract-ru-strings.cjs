#!/usr/bin/env node
'use strict';
/*
 * extract-ru-strings.cjs — Russian strings from a list of sources, each with its own exact address.
 *
 *   node .claude/scripts/extract-ru-strings.cjs --manifest <json> --out <dir> [--report <path>] [--dry-run]
 *
 * Manifest: JSON array of sources, each:
 *   { "address": "<label>", "kind": "ability-html" | "ability-file-html" | "file-html"
 *                                  | "ability-file-php" | "ability-file-json" | "ability-file-po",
 *     "ability": "<novamira ability name>",         // kind starts with "ability-"
 *     "input": { ... },                              // --input for the ability call
 *     "contentField": "raw_content" | "content",     // which output field holds the text, default "content"
 *     "path": "<local file path>" }                  // kind "file-html" only (already on disk, no site call)
 *
 * "*-html" kinds run the content through translate-blocks-pipeline.cjs extract (Gutenberg/HTML block markup) —
 *   writes <out>/<slug>/{source.html,skel.html,src.json,log.jsonl,report.json}.
 * "ability-html-sections" first splits the fetched content into top-level Gutenberg blocks, in order
 *   (depth-tracked on <!-- wp:X -->/<!-- /wp:X -->/<!-- wp:X /-->), each section gets its own extract work
 *   dir <out>/<slug>/section-NN/ and its own address "<address>/section-NN#<T-id>" — the section order and
 *   count are in the report under "sections".
 * "*-php" scans for Cyrillic in quoted string literals, line by line — address "<address>:<line>".
 * "*-json" walks a JSON file for Cyrillic leaf strings — address "<address>#<json-pointer>".
 * "*-po" parses gettext msgid/msgstr pairs where msgstr has Cyrillic — address "<address>#<index>".
 *
 * Fetching a site object goes through the local novamira CLI (node .claude/scripts/site.cjs run <ability>
 * --input @<tmpfile>), never through an MCP tool call — this script makes no network call of its own and
 * calls no external model. Read-only: no ability named here writes to the site.
 *
 * Output per source is additionally merged into <out>/strings.json: a flat array of {source, address, text}
 * covering every source, for the readiness criterion's single count.
 *
 * Console (run-scripts contract): {"status":"ok|work|stop","done":N,"left":N,"report":"<path>"}.
 * Exit: 0 ok · 1 some sources failed (left>0, rerun-safe) · 2 stop (manifest unreadable, contract broken).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);

const manifestPath = opt('--manifest');
const outDir = opt('--out');
const reportPath = opt('--report', outDir ? path.join(outDir, 'extract-ru-strings-report.json') : null);
const dryRun = flag('--dry-run');

function finish(status, details) {
  if (!reportPath) { console.log(JSON.stringify({ status: 'stop', error: '--report or --out is required' })); process.exit(2); }
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(details, null, 1), 'utf8');
  const done = details.sources.filter((s) => s.ok).length;
  const left = details.sources.length - done;
  console.log(JSON.stringify({ status, done, left, report: reportPath, dry_run: dryRun }));
  process.exit({ ok: 0, work: 1, stop: 2 }[status]);
}

if (!manifestPath || !fs.existsSync(manifestPath)) finish('stop', { sources: [], error: 'manifest not readable' });
let manifest;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { finish('stop', { sources: [], error: 'manifest is not valid JSON' }); }
if (!Array.isArray(manifest) || !manifest.length) finish('stop', { sources: [], error: 'manifest has no sources' });
if (!outDir) finish('stop', { sources: [], error: '--out is required' });
if (!dryRun) fs.mkdirSync(outDir, { recursive: true });

const slugify = (s) => s.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'src';
const hasCyrillic = (s) => /\p{Script=Cyrillic}/u.test(s);
const pipelineScript = path.join(__dirname, 'translate-blocks-pipeline.cjs');
const siteScript = path.join(__dirname, 'site.cjs');

function callAbility(ability, input) {
  const tmp = path.join(os.tmpdir(), `nova-in-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmp, JSON.stringify(input || {}), 'utf8');
  try {
    const r = spawnSync('node', [siteScript, '--json', 'run', ability, '--input', '@' + tmp],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' });
    let parsed;
    try { parsed = JSON.parse(r.stdout); } catch (e) { return { ok: false, error: (r.stderr || r.stdout || '').slice(0, 2000) }; }
    return parsed;
  } finally { fs.unlinkSync(tmp); }
}

// Splits on top-level <tag ...>...</tag> boundaries (depth-tracked, handles nested same-tag).
// Non-tag stretches between/around sections come back too (type "other") so nothing is dropped.
function splitByTag(html, tag) {
  const combined = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'gi');
  const tokens = [];
  let m;
  while ((m = combined.exec(html)) !== null) tokens.push({ idx: m.index, len: m[0].length, open: !m[0].startsWith('</') });
  const chunks = [];
  let depth = 0, chunkStart = 0;
  for (const t of tokens) {
    if (depth === 0 && t.open) {
      if (t.idx > chunkStart) chunks.push({ type: 'other', html: html.slice(chunkStart, t.idx) });
      chunkStart = t.idx;
      depth = 1;
    } else if (t.open) {
      depth++;
    } else {
      depth--;
      if (depth === 0) { chunks.push({ type: 'section', html: html.slice(chunkStart, t.idx + t.len) }); chunkStart = t.idx + t.len; }
    }
  }
  if (chunkStart < html.length) chunks.push({ type: 'other', html: html.slice(chunkStart) });
  return chunks;
}

// Cyrillic inside HTML comments is invisible to the pipeline's tokenizer (comments pass through unparsed)
// but still counts under a strict grep-by-Cyrillic criterion — list it separately, informational only.
function cyrillicComments(html) {
  const out = [];
  const re = /<!--[\s\S]*?-->/g;
  let m;
  while ((m = re.exec(html)) !== null) if (hasCyrillic(m[0])) out.push(m[0].trim());
  return out;
}

function runPipelineExtract(htmlText, slug) {
  const work = path.join(outDir, slug);
  fs.mkdirSync(work, { recursive: true });
  const inFile = path.join(work, 'in.html');
  fs.writeFileSync(inFile, htmlText, 'utf8');
  const glossary = path.join('project', 'reference', 'translation-glossary.md');
  const r = spawnSync('node', [pipelineScript, 'extract', '--in', inFile, '--work', work, '--glossary', glossary],
    { encoding: 'utf8', shell: process.platform === 'win32' });
  let out;
  try { out = JSON.parse(r.stdout); } catch (e) { return { ok: false, error: 'pipeline output not JSON: ' + (r.stdout || r.stderr || '').slice(0, 500) }; }
  if (!out.ok) return { ok: false, error: 'pipeline exit ' + out.exit };
  const src = JSON.parse(fs.readFileSync(path.join(work, 'src.json'), 'utf8'));
  return { ok: true, work, items: src.map((it) => ({ subaddress: it.id, text: it.text })) };
}

function extractPhpLines(text, address) {
  const items = [];
  const lines = text.split(/\r?\n/);
  const litRe = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  lines.forEach((line, i) => {
    if (!hasCyrillic(line)) return;
    let m; let found = false;
    while ((m = litRe.exec(line)) !== null) {
      const val = m[1] !== undefined ? m[1] : m[2];
      if (val && hasCyrillic(val)) { items.push({ subaddress: String(i + 1), text: val }); found = true; }
    }
    if (!found) items.push({ subaddress: String(i + 1), text: line.trim() });
  });
  return items;
}

function walkJson(node, pointer, out) {
  if (typeof node === 'string') { if (hasCyrillic(node)) out.push({ subaddress: pointer || '/', text: node }); return; }
  if (Array.isArray(node)) { node.forEach((v, i) => walkJson(v, pointer + '/' + i, out)); return; }
  if (node && typeof node === 'object') { for (const k of Object.keys(node)) walkJson(node[k], pointer + '/' + k, out); }
}

function parsePo(text) {
  const items = [];
  const lines = text.split(/\r?\n/);
  let curMsgid = null, curMsgstr = null, mode = null, idx = 0;
  const flush = () => {
    if (curMsgstr !== null && hasCyrillic(curMsgstr)) items.push({ subaddress: String(idx++), text: curMsgstr, msgid: curMsgid });
    curMsgid = null; curMsgstr = null; mode = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const mId = /^msgid\s+"(.*)"$/.exec(line);
    const mStr = /^msgstr\s+"(.*)"$/.exec(line);
    const mCont = /^"(.*)"$/.exec(line);
    if (mId) { flush(); curMsgid = mId[1]; mode = 'id'; continue; }
    if (mStr) { curMsgstr = mStr[1]; mode = 'str'; continue; }
    if (mCont && mode === 'id') { curMsgid += mCont[1]; continue; }
    if (mCont && mode === 'str') { curMsgstr += mCont[1]; continue; }
  }
  flush();
  return items;
}

const sources = [];
const merged = [];

for (const src of manifest) {
  const address = src.address || '(no address)';
  const slug = slugify(address);
  const entry = { address, kind: src.kind, ok: false };
  try {
    let text;
    if (src.kind === 'file-html') {
      text = fs.readFileSync(src.path, 'utf8');
    } else if (src.kind && src.kind.startsWith('ability-')) {
      if (dryRun) { entry.ok = true; entry.would = 'call ' + src.ability; sources.push(entry); continue; }
      const r = callAbility(src.ability, src.input);
      if (!r || r.ok === false) { entry.error = (r && (r.error && (r.error.message || r.error))) || 'ability call failed'; sources.push(entry); continue; }
      const field = src.contentField || 'content';
      text = r.data && r.data[field];
      if (text === undefined) { entry.error = `field "${field}" not in ability response`; sources.push(entry); continue; }
    } else {
      entry.error = 'unknown kind'; sources.push(entry); continue;
    }

    if (src.kind === 'ability-html-sections') {
      const tag = src.splitTag || 'section';
      const chunks = splitByTag(text, tag).filter((c) => c.type === 'section' || c.html.trim());
      entry.sections = [];
      let anyFail = false;
      let n = 0;
      chunks.forEach((chunk) => {
        const secLabel = chunk.type === 'section' ? 'section-' + String(++n).padStart(2, '0') : 'other-' + (n + 1);
        const r = runPipelineExtract(chunk.html, path.join(slug, secLabel));
        if (!r.ok) { entry.sections.push({ section: secLabel, type: chunk.type, ok: false, error: r.error }); anyFail = true; return; }
        entry.sections.push({ section: secLabel, type: chunk.type, ok: true, work: r.work, count: r.items.length });
        r.items.forEach((it) => merged.push({ source: address, address: `${address}/${secLabel}#${it.subaddress}`, text: it.text }));
        cyrillicComments(chunk.html).forEach((c, ci) => merged.push({ source: address, address: `${address}/${secLabel}#comment:${ci + 1}`, text: c, kind: 'comment-not-translated' }));
      });
      entry.ok = !anyFail; entry.count = n;
    } else if (src.kind.endsWith('-html')) {
      const r = runPipelineExtract(text, slug);
      if (!r.ok) { entry.error = r.error; sources.push(entry); continue; }
      entry.ok = true; entry.work = r.work; entry.count = r.items.length;
      r.items.forEach((it) => merged.push({ source: address, address: `${address}#${it.subaddress}`, text: it.text }));
    } else if (src.kind.endsWith('-php')) {
      const items = extractPhpLines(text, address);
      entry.ok = true; entry.count = items.length;
      items.forEach((it) => merged.push({ source: address, address: `${address}:${it.subaddress}`, text: it.text }));
    } else if (src.kind.endsWith('-json')) {
      const items = []; walkJson(JSON.parse(text), '', items);
      entry.ok = true; entry.count = items.length;
      items.forEach((it) => merged.push({ source: address, address: `${address}#${it.subaddress}`, text: it.text }));
    } else if (src.kind.endsWith('-po')) {
      const items = parsePo(text);
      entry.ok = true; entry.count = items.length;
      items.forEach((it) => merged.push({ source: address, address: `${address}#${it.subaddress}`, text: it.text, msgid: it.msgid }));
    } else {
      entry.error = 'unknown kind suffix';
    }
  } catch (e) {
    entry.error = String((e && e.message) || e);
  }
  sources.push(entry);
}

if (!dryRun) fs.writeFileSync(path.join(outDir, 'strings.json'), JSON.stringify(merged, null, 1) + '\n', 'utf8');

const failed = sources.filter((s) => !s.ok && !s.would);
const status = failed.length === sources.length && sources.length > 0 ? 'stop' : (failed.length ? 'work' : 'ok');
finish(status, { sources, merged_count: merged.length, strings_path: dryRun ? null : path.join(outDir, 'strings.json') });
