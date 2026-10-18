#!/usr/bin/env node
// assemble-home-blocks.cjs — concatenates <work-root>/{other-1,section-01..10,other-11}/out.html
// into the single core/html block's `content` attribute string, stripping the wp:html block
// delimiter comments at the outer edges only (other-1's leading comment, other-11's trailing comment).
// node .claude/scripts/assemble-home-blocks.cjs --work-root <dir> --out <content.txt>
// stdout: summary JSON {ok, bytes, cyrillic: bool}. Exit 0 ok, 1 cyrillic found, 2 stop.
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const workRoot = opt('--work-root');
const outFile = opt('--out');
if (!workRoot || !outFile) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'usage: --work-root <dir> --out <content.txt>' }) + '\n');
  process.exit(2);
}

const ORDER = ['other-1', 'section-01', 'section-02', 'section-03', 'section-04', 'section-05',
  'section-06', 'section-07', 'section-08', 'section-09', 'section-10', 'other-11'];

// Joiner bytes lost at each split boundary when the upstream splitter cut the live raw_content
// into these 12 pieces — confirmed byte-for-byte against a live backup of the page: the split
// dropped the "\r\n" that sits between adjacent <section> blocks for section-01..section-10;
// other-1/other-11 need no joiner (the boundary there was already whole). Without this, the
// assembled content is structurally byte-different from the live page outside any translated
// text node — the readiness criterion ("block markup outside text nodes identical to source,
// byte for byte") would fail.
const LEAD = '<!-- wp:html -->\n';
const TRAIL = '\n<!-- /wp:html -->';

function joinerAfter(name) {
  const m = /^section-(\d\d)$/.exec(name);
  if (m && m[1] !== '10') return '\r\n'; // section-01..section-09, each followed by another section-NN
  return '';
}

const missing = ORDER.filter((name) => !fs.existsSync(path.join(workRoot, name, 'out.html')));
if (missing.length) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'missing out.html', missing }) + '\n');
  process.exit(2);
}

const parts = [];
for (const name of ORDER) {
  const file = path.join(workRoot, name, 'out.html');
  let text = fs.readFileSync(file, 'utf8');
  if (name === 'other-1') {
    if (!text.startsWith(LEAD)) {
      process.stdout.write(JSON.stringify({ ok: false, error: `other-1/out.html does not start with the wp:html marker` }) + '\n');
      process.exit(2);
    }
    text = text.slice(LEAD.length);
  }
  if (name === 'other-11') {
    if (!text.endsWith(TRAIL)) {
      process.stdout.write(JSON.stringify({ ok: false, error: `other-11/out.html does not end with the /wp:html marker` }) + '\n');
      process.exit(2);
    }
    text = text.slice(0, -TRAIL.length);
  }
  parts.push(text);
  parts.push(joinerAfter(name));
}

// Bug found on an earlier attempt (Intent check): stripping LEAD/TRAIL above without ever
// restoring them left the assembled content with NO wp:html wrapper at all — the live page
// then saves as core/freeform instead of core/html. Re-wrap the whole assembled string once,
// at the outer edges, exactly as the live source carries it.
const content = LEAD + parts.join('') + TRAIL;
const hasCyrillic = /\p{Script=Cyrillic}/u.test(content);
fs.writeFileSync(outFile, content, 'utf8');
process.stdout.write(JSON.stringify({ ok: !hasCyrillic, bytes: Buffer.byteLength(content, 'utf8'), cyrillic: hasCyrillic }) + '\n');
process.exitCode = hasCyrillic ? 1 : 0;
