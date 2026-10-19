#!/usr/bin/env node
// apply-line-strings.cjs — applies tr-*.json entries addressed by line number
// (address "<source>:<line>", 1-indexed) onto a local copy of a live text/PHP file,
// replacing the exact OLD (RU) substring on that line with the NEW (EN) text, in
// left-to-right order for entries sharing one line. All-or-nothing: if any address's
// old text is not found on its line (file drifted since extraction), nothing is written.
// node .claude/scripts/apply-line-strings.cjs --in <live.txt> --strings <strings-shell.json> --tr <tr-shell.json> --source <source-key> --out <new.txt>
// stdout: summary JSON {ok, applied:[{line,old,new}], problems:[...]}. Exit 0 ok, 1 mismatch (no write), 2 stop.
'use strict';
const fs = require('fs');

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const inFile = opt('--in'), stringsFile = opt('--strings'), trFile = opt('--tr'), source = opt('--source'), outFile = opt('--out');

function stop(msg) { process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n'); process.exit(2); }
if (!inFile || !stringsFile || !trFile || !source || !outFile) stop('usage: --in --strings --tr --source --out');

let text, strings, tr;
try { text = fs.readFileSync(inFile, 'utf8'); } catch (e) { stop(`--in unreadable: ${e.message}`); }
try { strings = JSON.parse(fs.readFileSync(stringsFile, 'utf8')); } catch (e) { stop(`--strings unreadable: ${e.message}`); }
try { tr = JSON.parse(fs.readFileSync(trFile, 'utf8')); } catch (e) { stop(`--tr unreadable: ${e.message}`); }

function byLine(list) {
  const entries = [];
  for (const it of list) {
    if (it.source !== source) continue;
    const i = it.address.lastIndexOf(':');
    if (i < 0) continue;
    const line = Number(it.address.slice(i + 1));
    if (!Number.isInteger(line) || line < 1) stop(`bad line address: ${it.address}`);
    entries.push({ line, text: it.text, address: it.address });
  }
  return entries;
}
const oldEntries = byLine(strings);
const newEntries = byLine(tr);
if (oldEntries.length === 0) stop(`no line addresses found for source ${source}`);
if (oldEntries.length !== newEntries.length) stop(`strings/tr line-entry count differs: ${oldEntries.length} vs ${newEntries.length}`);
for (let i = 0; i < oldEntries.length; i++) {
  if (oldEntries[i].address !== newEntries[i].address) stop(`address order differs at index ${i}: ${oldEntries[i].address} vs ${newEntries[i].address}`);
}

const nl = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text.split(/\r\n|\n/);

// Group entries by line, preserving original array order within a line.
const byLineNum = new Map();
for (let i = 0; i < oldEntries.length; i++) {
  const ln = oldEntries[i].line;
  if (!byLineNum.has(ln)) byLineNum.set(ln, []);
  byLineNum.get(ln).push({ old: oldEntries[i].text, new: newEntries[i].text, address: oldEntries[i].address });
}

const problems = [];
const applied = [];
for (const [ln, items] of byLineNum) {
  if (ln > lines.length) { problems.push(`${items[0].address}: line ${ln} is beyond file length ${lines.length}`); continue; }
  let line = lines[ln - 1];
  let cursor = 0;
  const replacements = [];
  for (const it of items) {
    const idx = line.indexOf(it.old, cursor);
    if (idx < 0) { problems.push(`${it.address}: old text "${it.old}" not found on line ${ln} from column ${cursor} — the file has drifted since extraction, do not write`); continue; }
    replacements.push({ idx, old: it.old, new: it.new, address: it.address });
    cursor = idx + it.old.length;
  }
  if (replacements.length !== items.length) continue; // leave line untouched if any item on it failed; reported above
  // apply right-to-left so earlier indices stay valid
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    line = line.slice(0, r.idx) + r.new + line.slice(r.idx + r.old.length);
    applied.push({ line: ln, old: r.old, new: r.new, address: r.address });
  }
  lines[ln - 1] = line;
}

if (problems.length) {
  process.stdout.write(JSON.stringify({ ok: false, applied: [], problems }, null, 2) + '\n');
  process.exit(1);
}
fs.writeFileSync(outFile, lines.join(nl), 'utf8');
process.stdout.write(JSON.stringify({ ok: true, applied, problems: [] }, null, 2) + '\n');
