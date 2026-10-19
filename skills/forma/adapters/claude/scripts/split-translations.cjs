#!/usr/bin/env node
// split-translations.cjs — splits a tr-*.json file ([{source, address, text}]) by `source`,
// writing <work-root>/<folder-for-source>/tr.json as [{id, text}] for translate-blocks-pipeline.cjs apply.
// node .claude/scripts/split-translations.cjs --tr <tr.json> --work-root <dir> --map <map.json>
//   map.json: {"<source>": "<folder-name-under-work-root>", ...}
// stdout: summary JSON {ok, written:[{source,folder,count}], skipped:[source,...]}. Exit 0 ok, 2 stop.
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

function stop(msg) {
  process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
  process.exit(2);
}

const trFile = opt('--tr');
const workRoot = opt('--work-root');
const mapFile = opt('--map');
if (!trFile || !workRoot || !mapFile) stop('usage: --tr <tr.json> --work-root <dir> --map <map.json>');

let tr, map;
try { tr = JSON.parse(fs.readFileSync(trFile, 'utf8')); } catch (e) { stop(`tr.json unreadable: ${e.message}`); }
try { map = JSON.parse(fs.readFileSync(mapFile, 'utf8')); } catch (e) { stop(`map.json unreadable: ${e.message}`); }
if (!Array.isArray(tr)) stop('tr.json is not an array');

const bySource = new Map();
for (const item of tr) {
  if (!item || typeof item.source !== 'string' || typeof item.address !== 'string' || typeof item.text !== 'string') {
    stop(`bad item shape: ${JSON.stringify(item)}`);
  }
  const hashIdx = item.address.indexOf('#');
  if (hashIdx < 0) continue; // not a skel/src-id address (json-pointer or line address) — not our concern here
  const id = item.address.slice(hashIdx + 1);
  if (!/^T\d{3,}$/.test(id)) continue; // not a skel/src-id address (e.g. theme-json JSON pointer) — not our concern here
  const key = item.address.slice(0, hashIdx); // group by address prefix, not `source` (several addresses can share one `source`, e.g. home-19 sections)
  if (!bySource.has(key)) bySource.set(key, []);
  bySource.get(key).push({ id, text: item.text });
}

const written = [];
const skipped = [];
for (const [source, items] of bySource) {
  const folder = map[source];
  if (!folder) { skipped.push(source); continue; }
  const dir = path.join(workRoot, folder);
  if (!fs.existsSync(dir)) stop(`folder does not exist: ${dir}`);
  items.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(dir, 'tr.json'), JSON.stringify(items, null, 2) + '\n', 'utf8');
  written.push({ source, folder, count: items.length });
}
for (const source of Object.keys(map)) {
  if (!bySource.has(source) && !written.find((w) => w.source === source)) {
    // source declared in map but had zero #Txxx entries in tr.json (e.g. nav-4 with 0 strings) — not an error
    skipped.push(source + ' (0 entries)');
  }
}

process.stdout.write(JSON.stringify({ ok: true, written, skipped }, null, 2) + '\n');
