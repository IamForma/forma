#!/usr/bin/env node
'use strict';

// Self-check for gen-gemini-roles.cjs: run directly, no card, no project data.
//   node .claude/scripts/checks/support/test-gen-gemini-roles.cjs
// Exit 0 — pass, 1 — fail (prints which assertion).
//
// Checks against the real repo (read-only) and against a scratch copy (read-write), so the test
// never edits `.claude/agents/` or `.agents/plugins/forma/agents/` themselves.

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '../../../..');
const gen = require('./gen-gemini-roles.cjs');

let failures = 0;
function assert(cond, label) {
  if (cond) { console.log(`OK   ${label}`); }
  else { failures++; console.log(`FAIL ${label}`); }
}

// 1) Repo is in sync today: every role/on-demand pair must render byte-identical to disk.
const planned = gen.checkAll(ROOT);
const drift = planned.filter((p) => p.res.status !== 'synced');
assert(drift.length === 0, `repo mirror fully reproduced (${planned.length} pairs, ${drift.length} drift)`);
for (const d of drift) console.log(`     — ${d.entry.relFile}: ${d.res.status}${d.res.detail ? ' (' + d.res.detail + ')' : ''}`);

// 2) Idempotency: applying twice on the real tree writes nothing the second time (dry-run, no writes either time).
const first = gen.applyAll(ROOT, { dryRun: true });
assert(first.written.length === 0 && first.problems.length === 0, 'dry-run on real tree: nothing to write, no problems');

// 3) Drift detection + fix, on a disposable scratch copy (never touches the real mirror).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-gemini-roles-selfcheck-'));
try {
  const claudeSrc = path.join(ROOT, '.claude', 'agents');
  const geminiSrc = path.join(ROOT, '.agents', 'plugins', 'forma', 'agents');
  const claudeDst = path.join(tmp, '.claude', 'agents');
  const geminiDst = path.join(tmp, '.agents', 'plugins', 'forma', 'agents');
  copyDir(claudeSrc, claudeDst);
  copyDir(geminiSrc, geminiDst);

  const kitPath = path.join(geminiDst, 'kit.md');
  const before = fs.readFileSync(kitPath, 'utf8');
  fs.writeFileSync(kitPath, before.replace('agents/on-demand/kit-recon.md', 'MUTATED/kit-recon.md'));

  const checked = gen.checkAll(tmp);
  const kitEntry = checked.find((p) => p.entry.relFile === 'kit.md');
  assert(kitEntry && kitEntry.res.status === 'drift', 'mutated kit.md detected as drift');

  const applied = gen.applyAll(tmp, { dryRun: false });
  assert(applied.written.some((w) => w.relFile === 'kit.md'), 'apply writes the drifted file');

  const afterApply = fs.readFileSync(kitPath, 'utf8');
  assert(afterApply === before, 'apply restores exact original content');

  const secondApply = gen.applyAll(tmp, { dryRun: false });
  assert(secondApply.written.length === 0, 'second apply is a no-op (idempotent)');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
