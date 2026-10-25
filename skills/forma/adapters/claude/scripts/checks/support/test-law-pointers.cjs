'use strict';

// Self-check of checks/law-pointers.cjs: pass and fail case on a throwaway role directory.
//   node --test .claude/scripts/checks/support/test-law-pointers.cjs

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const lp = require('../law-pointers.cjs');

const LAW = 'See `kit.md`, `spec.md`, `PROJECT.md`, `claude-8.md`, `VARS/credentials.md`, `.env`.';

function dir(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'law-ptr-'));
  for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(d, n), t);
  return d;
}

test('pointers skip non-role names', () => {
  assert.deepStrictEqual(lp.pointers(LAW), ['kit.md', 'spec.md']);
});

test('pass: both files exist with a marker', () => {
  const d = dir({ 'kit.md': '<!-- moved-from-law: a -->', 'spec.md': 'x\n<!-- moved-from-law: b -->' });
  assert.deepStrictEqual(lp.verify(LAW, [d]), []);
});

test('fail: missing file and file without marker', () => {
  const d = dir({ 'kit.md': 'no marker here' });
  const p = lp.verify(LAW, [d]);
  assert.strictEqual(p.length, 2);
  assert.match(p[0], /kit\.md.*moved-from-law/);
  assert.match(p[1], /spec\.md.*не найден/);
});
