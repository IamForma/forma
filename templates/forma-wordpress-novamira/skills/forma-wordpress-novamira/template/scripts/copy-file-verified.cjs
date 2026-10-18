#!/usr/bin/env node
// Copy one file byte-for-byte, verify by sha256, confirm the source is untouched,
// and check that every relative src="..." and url(...) reference in the copy resolves.
// Usage: node .claude/scripts/copy-file-verified.cjs <source> <destination>
// Output: one JSON line {status, source_sha256, dest_sha256, source_unchanged, refs_total, refs_missing[]}
// status: ok | fail. Exit 0 on ok, 1 on fail. Refuses to overwrite an existing destination.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [src, dst] = process.argv.slice(2);
const out = (o, code) => { console.log(JSON.stringify(o)); process.exit(code); };
if (!src || !dst) out({ status: 'fail', reason: 'usage: <source> <destination>' }, 1);
if (!fs.existsSync(src)) out({ status: 'fail', reason: 'source missing' }, 1);
if (fs.existsSync(dst)) out({ status: 'fail', reason: 'destination exists, not overwritten' }, 1);
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const before = sha(src);
fs.copyFileSync(src, dst);
const after = sha(dst), srcAfter = sha(src);
const text = fs.readFileSync(dst, 'utf8');
const refs = new Set();
for (const m of text.matchAll(/src="([^"#?]+)"|url\(['"]?([^'")]+)['"]?\)/g)) {
  const r = m[1] || m[2];
  if (r && !/^(https?:|data:|mailto:|tel:|\/\/|#|javascript:)/i.test(r) && /\.[a-z0-9]{2,5}$/i.test(r)) refs.add(r);
}
const missing = [...refs].filter(r => !fs.existsSync(path.resolve(path.dirname(dst), decodeURI(r))));
const ok = before === after && before === srcAfter && missing.length === 0;
out({ status: ok ? 'ok' : 'fail', source_sha256: before, dest_sha256: after, source_unchanged: before === srcAfter, refs_total: refs.size, refs_missing: missing }, ok ? 0 : 1);
