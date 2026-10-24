// Включатель движков: реестр спящих читается, sleep и wake правят его, claude не усыпляется.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'skills', 'forma', 'adapters', 'claude', 'scripts', 'engine-switch.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-switch-'));
fs.mkdirSync(path.join(dir, '.forma'));
const registry = path.join(dir, '.forma', 'engines.json');
fs.writeFileSync(registry, '{ "dormant": ["codex"] }\n');
const sw = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: dir, encoding: 'utf8' });
const dormant = () => JSON.parse(fs.readFileSync(registry, 'utf8')).dormant;

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('status показывает спящие и активные', () => {
  const r = sw('status');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /codex: спит/);
  assert.match(r.stdout, /gemini: активен/);
});

test('sleep и wake правят реестр, повтор не дублирует', () => {
  sw('sleep', 'gemini'); sw('sleep', 'gemini');
  assert.deepEqual(dormant(), ['codex', 'gemini']);
  sw('wake', 'gemini');
  assert.deepEqual(dormant(), ['codex']);
});

test('claude не усыпляется, неизвестный движок отклоняется', () => {
  assert.equal(sw('sleep', 'claude').status, 1);
  assert.equal(sw('sleep', 'nope').status, 1);
  assert.deepEqual(dormant(), ['codex']);
});

test('wake codex без адаптера: стоп, а не молчаливый успех', () => {
  const r = sw('wake', 'codex');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /нет \.codex\/scripts\/sync-codex\.cjs/);
});

// MiniMax: спящий по реестру, пересборка по таблице REBUILD в заданном порядке, спящий не сверяется.
const MM_STEPS = ['.minimax/scripts/gen-roles.cjs', '.minimax/scripts/gen-plugin-agents.cjs', '.minimax/scripts/install-plugin.cjs', '.minimax/tests/test-minimax-adapter.cjs'];
const mmProject = (withSteps) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-switch-mm-'));
  fs.mkdirSync(path.join(d, '.forma'));
  fs.writeFileSync(path.join(d, '.forma', 'engines.json'), '{ "dormant": ["codex", "minimax"] }\n');
  if (withSteps) for (const s of MM_STEPS) {
    fs.mkdirSync(path.dirname(path.join(d, s)), { recursive: true });
    fs.writeFileSync(path.join(d, s), `require('fs').appendFileSync(${JSON.stringify(path.join(d, 'order.log'))}, ${JSON.stringify(s)} + '\\n');`);
  }
  return d;
};
const swIn = (d, ...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: d, encoding: 'utf8' });

test('status: minimax спит, пока он в реестре', () => {
  const d = mmProject(false);
  try {
    const r = swIn(d, 'status');
    assert.match(r.stdout, /minimax: спит/);
    assert.match(r.stdout, /codex: спит/);
    assert.match(r.stdout, /gemini: активен/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('wake minimax: маркер снят, четыре шага пересборки идут по порядку', () => {
  const d = mmProject(true);
  try {
    const r = swIn(d, 'wake', 'minimax');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(d, '.forma', 'engines.json'), 'utf8')).dormant, ['codex']);
    assert.deepEqual(fs.readFileSync(path.join(d, 'order.log'), 'utf8').trim().split(/\r?\n/), MM_STEPS);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('wake minimax без адаптера: стоп на первом шаге', () => {
  const d = mmProject(false);
  try {
    const r = swIn(d, 'wake', 'minimax');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /нет \.minimax\/scripts\/gen-roles\.cjs/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('сверка читает реестр: спящий движок не сверяется (паритет ролей и тест адаптера)', () => {
  const dir = path.resolve(__dirname, '..', 'skills', 'forma', 'adapters', 'claude', 'scripts', 'checks');
  const dormantLib = require(path.join(dir, 'support', 'dormant.cjs'));
  const d = mmProject(false);
  try {
    assert.equal(dormantLib.isDormant(d, 'minimax'), true);
    fs.writeFileSync(path.join(d, '.forma', 'engines.json'), '{ "dormant": ["codex"] }\n');
    assert.equal(dormantLib.isDormant(d, 'minimax'), false);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
  assert.match(fs.readFileSync(path.join(dir, 'support', 'role-parity.cjs'), 'utf8'), /!isDormant\(root, p\.id\)/);
  assert.match(fs.readFileSync(path.join(dir, 'adapter-conformance.cjs'), 'utf8'), /id: E\.idOf\(a\)/);
});
