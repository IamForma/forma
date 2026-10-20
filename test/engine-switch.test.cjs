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
