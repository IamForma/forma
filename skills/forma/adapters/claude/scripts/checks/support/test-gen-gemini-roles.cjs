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
const { ROLE_EQUIVALENCE } = require('./role-parity.cjs');

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
  // Папки зеркала — из адаптеров реального проекта; во временной копии адаптеры — заглушки с теми же sources.
  const ctx = gen.ctxOf(ROOT);
  const claudeDst = path.join(tmp, ctx.from.src.rolesDir);
  const geminiDst = path.join(tmp, ctx.to.src.rolesDir);
  copyDir(path.join(ROOT, ctx.from.src.rolesDir), claudeDst);
  copyDir(path.join(ROOT, ctx.to.src.rolesDir), geminiDst);
  for (const e of [ctx.from, ctx.to]) {
    const stub = `module.exports = ${JSON.stringify({ engine: e.id, id: e.id, sources: e.src })};
`;
    fs.mkdirSync(path.join(tmp, e.dir), { recursive: true });
    fs.writeFileSync(path.join(tmp, e.dir, 'forma-adapter.cjs'), stub);
  }

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

  // 4) Role-equivalence table: a table role with no pair is skipped; any other unpaired role is a problem.
  const [[eqSrc]] = ROLE_EQUIVALENCE;
  const eqFile = path.join(claudeDst, eqSrc + '.md');
  assert(fs.existsSync(eqFile) && !fs.existsSync(path.join(geminiDst, eqSrc + '.md')), `fixture: table role ${eqSrc} present, no pair`);
  const eqRun = gen.applyAll(tmp, { dryRun: false });
  assert(eqRun.problems.length === 0 && !eqRun.written.some((w) => w.relFile === eqSrc + '.md'), 'role from the equivalence table is skipped, no problem');
  const orphan = path.join(claudeDst, 'orphan-not-in-table.md');
  fs.copyFileSync(eqFile, orphan);
  const orphanRun = gen.applyAll(tmp, { dryRun: false });
  assert(orphanRun.problems.some((p) => JSON.stringify(p).includes('orphan-not-in-table')), 'unpaired role outside the table is a problem');
  fs.rmSync(orphan);
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
