'use strict';
// node .claude/scripts/plumb-run.test.cjs — reads the real Plumb row of project/config/PROJECT.md.
// PLUMB_RUN=<file> points the test at another copy of the driver (to show it fails on old code).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const driver = process.env.PLUMB_RUN ? path.resolve(process.env.PLUMB_RUN) : path.join(root, '.forma', 'plumb', 'plumb-run.cjs');
const { readThresholds, plumbLine } = require(driver);

assert.strictEqual(typeof readThresholds, 'function', 'readThresholds exported');
assert.strictEqual(typeof plumbLine, 'function', 'plumbLine exported');

// Real row: jev has all four thresholds, none null.
const jev = readThresholds(root, 'jev');
assert.ok(jev, 'jev thresholds read');
assert.deepStrictEqual(jev, { leader: 70, gap: 20, noul: 70, clarity: 3 });
for (const v of Object.values(jev)) assert.notStrictEqual(v, null);

// haiku: leader and gap only; noul and clarity may be null.
const haiku = readThresholds(root, 'haiku');
assert.ok(haiku, 'haiku thresholds read');
assert.strictEqual(haiku.leader, 60);
assert.strictEqual(haiku.gap, 20);
assert.ok(haiku.noul == null && haiku.clarity == null);

// Legacy form (thresholds as text inside the Plumb row): three spellings of the gap key give one value.
const legacy = (key) => '| Plumb `plumb` | `jev`. haiku: лидер ≥ 60 %, ' + key + ' ≥ 20 п.п.; jev: лидер ≥ 70 %, ' + key + ' ≥ 20 п.п., noul лидера ≥ 70 %, ясность ≥ 3 из 4 |\n';
for (const key of ['отрыв от второго', 'зазор', 'gap']) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plumbrow-'));
  fs.mkdirSync(path.join(tmp, 'project', 'config'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'project', 'config', 'PROJECT.md'), legacy(key));
  const t = readThresholds(tmp, 'jev');
  assert.ok(t && t.gap === 20 && t.leader === 70, `gap key "${key}"`);
}

// Real PROJECT.md keeps the thresholds as anchored table rows (plumb.jev.gap …): rows win over the legacy text.
assert.ok(/k:plumb\.jev\.gap/.test(fs.readFileSync(path.join(root, 'project', 'config', 'PROJECT.md'), 'utf8')), 'anchored threshold rows');

// One scale: noul as a share 0..1 against a threshold in percent.
function result(noulValue) {
  return {
    choice: { role: 'r1', probabilities: { r1: 91, r2: 5 }, confidence: 90 },
    score: { clarity: 3, confidence: 80 },
    noul: { r1: noulValue },
    meta: { executor: 'jev', model_requested: 'm', id: 'x', usage: {}, cost_usd: 0, duration_ms: 1 },
  };
}
const low = plumbLine(result(0.5), root);
const high = plumbLine(result(0.9), root);
assert.ok(/ниже порога/.test(low) && /noul/.test(low), low);
assert.ok(/пороги пройдены/.test(high), high);
assert.ok(!/не прочитаны/.test(low) && !/не прочитаны/.test(high));

console.log('plumb-run.test: ok');
