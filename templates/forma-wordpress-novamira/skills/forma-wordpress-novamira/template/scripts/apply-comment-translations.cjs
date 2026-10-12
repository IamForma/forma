#!/usr/bin/env node
// apply-comment-translations.cjs — substitutes Russian dev-note HTML comments in
// <work-root>/*/out.html with their English translations from a {ru: en} map file.
// These comments are not T0xx addresses (translate-blocks-pipeline.cjs does not touch
// them by construction) — the saved markup still needs 0 Cyrillic, literally including comments.
//
// Only the text INSIDE non-block comments <!-- ... --> is replaced, matched exactly
// (trimmed) against the map key. Comments that open a Gutenberg block (<!-- wp:... -->,
// <!-- /wp:... -->) are never touched, by construction: wp: comments carry no free text
// this map covers, and this script explicitly skips any comment matching /^<!--\s*\/?wp:/.
// Everything else — tags, wp: comments, text nodes — passes through byte-for-byte.
//
// node .claude/scripts/apply-comment-translations.cjs --work-root <dir> --map <comments-ru.json> [--dry-run]
// stdout: summary JSON {ok, files:[{file, replaced, unmapped}], total_replaced, total_unmapped}.
// exit: 0 — every Russian non-wp comment found had a map entry and was replaced (or none found);
//       1 — at least one Russian non-wp comment had no map entry (out.html left untouched, files report which);
//       2 — stop (missing args, unreadable input).
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const workRoot = opt('--work-root');
const mapFile = opt('--map');
const dryRun = argv.includes('--dry-run');
if (!workRoot || !mapFile) {
  console.log(JSON.stringify({ ok: false, error: 'usage: --work-root <dir> --map <comments-ru.json> [--dry-run]' }));
  process.exit(2);
}

let map;
try { map = JSON.parse(fs.readFileSync(mapFile, 'utf8')); } catch (e) {
  console.log(JSON.stringify({ ok: false, error: `map unreadable: ${e.message}` }));
  process.exit(2);
}

const ORDER = ['other-1', 'section-01', 'section-02', 'section-03', 'section-04', 'section-05',
  'section-06', 'section-07', 'section-08', 'section-09', 'section-10', 'other-11'];

const RU = /\p{Script=Cyrillic}/u;
const COMMENT_RE = /<!--([\s\S]*?)-->/g;
const isWpComment = (inner) => /^\s*\/?wp:/.test(inner);

const files = [];
let totalReplaced = 0;
let totalUnmapped = 0;

for (const name of ORDER) {
  const file = path.join(workRoot, name, 'out.html');
  if (!fs.existsSync(file)) {
    files.push({ file, error: 'missing' });
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  let replaced = 0;
  const unmapped = [];
  const out = html.replace(COMMENT_RE, (m, inner) => {
    if (isWpComment(inner)) return m; // block-delimiter comment — never touched
    if (!RU.test(inner)) return m; // no Cyrillic — leave as is (already English, or empty)
    const trimmed = inner.trim();
    const lead = inner.slice(0, inner.indexOf(trimmed));
    const trail = inner.slice(inner.indexOf(trimmed) + trimmed.length);
    const en = map[trimmed];
    if (en === undefined) { unmapped.push(trimmed); return m; }
    replaced++;
    return `<!--${lead}${en}${trail}-->`;
  });
  if (unmapped.length) totalUnmapped += unmapped.length;
  totalReplaced += replaced;
  files.push({ file, replaced, unmapped });
  if (!dryRun && !unmapped.length) fs.writeFileSync(file, out, 'utf8');
}

const ok = totalUnmapped === 0;
console.log(JSON.stringify({ ok, dry_run: dryRun, files, total_replaced: totalReplaced, total_unmapped: totalUnmapped }, null, 2));
process.exitCode = ok ? 0 : 1;
