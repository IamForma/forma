#!/usr/bin/env node
// apply-json-pointer.cjs — applies tr-*.json entries addressed by JSON pointer (address "<source>#/a/b/c")
// onto a local copy of the live JSON file, verifying the OLD (RU) value at each pointer before overwriting.
// node .claude/scripts/apply-json-pointer.cjs --in <live.json> --strings <strings-shell.json> --tr <tr-shell.json> --source <source-key> --out <new.json>
// stdout: summary JSON {ok, applied:[pointer,...], problems:[...]}. Exit 0 ok, 1 mismatch (no write), 2 stop.
'use strict';
const fs = require('fs');

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const inFile = opt('--in'), stringsFile = opt('--strings'), trFile = opt('--tr'), source = opt('--source'), outFile = opt('--out');

function stop(msg) { process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n'); process.exit(2); }
if (!inFile || !stringsFile || !trFile || !source || !outFile) stop('usage: --in --strings --tr --source --out');

let doc, strings, tr;
try { doc = JSON.parse(fs.readFileSync(inFile, 'utf8')); } catch (e) { stop(`--in unreadable: ${e.message}`); }
try { strings = JSON.parse(fs.readFileSync(stringsFile, 'utf8')); } catch (e) { stop(`--strings unreadable: ${e.message}`); }
try { tr = JSON.parse(fs.readFileSync(trFile, 'utf8')); } catch (e) { stop(`--tr unreadable: ${e.message}`); }

function byPointer(list) {
  const m = new Map();
  for (const it of list) {
    if (it.source !== source) continue;
    const i = it.address.indexOf('#/');
    if (i < 0) continue;
    m.set(it.address.slice(i + 1), it.text); // "/a/b/c"
  }
  return m;
}
const oldMap = byPointer(strings);
const newMap = byPointer(tr);
if (oldMap.size === 0) stop(`no JSON-pointer addresses found for source ${source}`);
if (oldMap.size !== newMap.size) stop(`strings/tr pointer count differs: ${oldMap.size} vs ${newMap.size}`);

function get(obj, ptr) {
  const parts = ptr.split('/').filter((p) => p !== '');
  let cur = obj;
  for (const p of parts) {
    const key = /^\d+$/.test(p) ? Number(p) : p;
    if (cur == null || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}
function set(obj, ptr, value) {
  const parts = ptr.split('/').filter((p) => p !== '');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    cur = cur[key];
  }
  const last = parts[parts.length - 1];
  const key = /^\d+$/.test(last) ? Number(last) : last;
  cur[key] = value;
}

const problems = [];
const applied = [];
for (const [ptr, oldText] of oldMap) {
  const live = get(doc, ptr);
  if (live !== oldText) {
    problems.push(`${ptr}: live value "${live}" does not match expected old text "${oldText}" — the file has drifted since extraction, do not write`);
    continue;
  }
  applied.push(ptr);
}
if (problems.length) {
  process.stdout.write(JSON.stringify({ ok: false, applied: [], problems }, null, 2) + '\n');
  process.exit(1);
}
for (const ptr of applied) set(doc, ptr, newMap.get(ptr));
fs.writeFileSync(outFile, JSON.stringify(doc, null, '\t') + '\n', 'utf8');
process.stdout.write(JSON.stringify({ ok: true, applied, problems: [] }, null, 2) + '\n');
