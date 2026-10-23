'use strict';

// Self-check: the parity check, the role generator, the Codex check and the extensions script take engine folders
// from the adapters, not from their own text. A temporary fourth engine (`.demo/`, in a throwaway project copy,
// never in the real tree) is picked up without a single edit of the core files, and without its adapter it is not.
//   node .claude/scripts/checks/support/test-engine-roots.cjs        # exit 0 — passed

const fs = require('fs');
const os = require('os');
const path = require('path');

const parity = require('./role-parity.cjs');
const gen = require('./gen-gemini-roles.cjs');
const codex = require('../codex.cjs');
const roots = require('./engine-roots.cjs');
const ext = require('../../../../.forma/extensions/extensions.cjs');

let failures = 0;
function check(cond, label) {
  if (cond) console.log(`OK   ${label}`);
  else { failures++; console.log(`FAIL ${label}`); }
}

const adapterText = (id, sources) => `'use strict';\nmodule.exports = ${JSON.stringify({ engine: id + '-code', id, spendTag: id, sources })};\n`;
const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

// The own engine of these checks (its folder is where this file lives) plus the mirror engine, as stubs with the real sources.
const real = path.resolve(__dirname, '../../../..');
const own = roots.own(real);
const mirror = roots.find(real, 'gemini');
if (!own || !mirror) { console.log('SKIP no own/mirror adapter in this project: nothing to compare'); process.exit(0); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-roots-selfcheck-'));
try {
  for (const e of [own, mirror]) put(path.join(tmp, e.dir, 'forma-adapter.cjs'), adapterText(e.id, e.src));
  const body = '# `Intent`\n\nHello.\n';
  put(path.join(tmp, own.src.rolesDir, 'intent.md'), body);
  put(path.join(tmp, mirror.src.rolesDir, 'intent.md'), body);

  const peersOf = () => parity.compareRoles(tmp).map((r) => r.pair.to);

  // 1. Without a fourth engine: parity pairs only the connected ones.
  check(!peersOf().includes('demo'), 'no demo adapter: no demo pair in the parity table');

  // 2. With `.demo/` and a minimal adapter: its roles are compared, no core file edited.
  const demoSources = { rolesDir: '.demo/agents', onDemandRolesDir: '.demo/agents/on-demand', runRolesDir: '.demo/agents/run',
    scriptsDir: '.demo/scripts', skillsDir: '.demo/skills', testsDir: '.demo/tests', mcpConfigs: [] };
  put(path.join(tmp, '.demo', 'forma-adapter.cjs'), adapterText('demo', demoSources));
  put(path.join(tmp, '.demo', 'agents', 'intent.md'), body.replace('Hello', 'Changed'));
  const withDemo = parity.compareRoles(tmp);
  const demoRows = withDemo.filter((r) => r.pair.to === 'demo');
  check(demoRows.length > 0, 'demo adapter present: demo pairs appear in the parity table');
  const intentRow = demoRows.find((r) => r.pair.name === 'Agent: Intent');
  check(intentRow && intentRow.res.status === 'drift', 'demo role with different text reads as drift');
  check(withDemo.filter((r) => r.pair.to === mirror.id).every((r) => r.res.status !== 'drift' || r.pair.name !== 'Agent: Intent'),
    'the mirror engine pair is unaffected by the fourth engine');
  check(parity.parityTable(withDemo).some((l) => l.includes('.demo/agents')), 'the table names the demo files');

  // 3. The role generator follows the adapters (mirror folder from sources, not from the script).
  const ctx = gen.ctxOf(tmp);
  check(ctx && ctx.to.src.rolesDir === mirror.src.rolesDir && ctx.from.src.rolesDir === own.src.rolesDir, 'generator paths come from the adapters');
  put(path.join(tmp, mirror.src.rolesDir, 'intent.md'), '---\nmodel: x\n---\n# `Intent`\n');
  check(gen.planAll(tmp).some((p) => p.relFile === 'intent.md'), 'generator plans the role of the source folder');

  // 4. Codex: no folder of that engine — skipped without error.
  const info = [];
  check(Array.isArray(codex.run({ root: tmp, info })) && info.length === 0, 'codex check skips quietly without its folder');

  // 5. Extensions: `project/extensions/demo/` goes to the adapter folder; without adapter and folder it is not there.
  check(!ext.engineDirs(tmp).demo || ext.engineDirs(tmp).demo === '.demo', 'extensions: demo maps to its adapter folder');
  put(path.join(tmp, 'project', 'extensions', 'demo', 'agents', 'run', 'r.md'), 'x');
  const dst = ext.sources(tmp).map((x) => x.dst.split(path.sep).join('/'));
  check(dst.includes('.demo/agents/run/r.md'), 'extensions: project/extensions/demo/ -> the adapter folder');

  // 6. Engine removed: adapter file gone — the pair is gone with it.
  fs.rmSync(path.join(tmp, '.demo'), { recursive: true, force: true });
  check(!peersOf().includes('demo'), 'demo adapter removed: its pairs are gone, checks still run');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
