'use strict';
// Тест permissions-level.cjs: node --test .claude/scripts/permissions-level.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, 'permissions-level.cjs');
const levels = path.join(__dirname, '..', 'permission-levels.json');

function project(local) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perm-'));
  fs.mkdirSync(path.join(root, '.claude'));
  fs.copyFileSync(levels, path.join(root, '.claude', 'permission-levels.json'));
  if (local) fs.writeFileSync(path.join(root, '.claude', 'settings.local.json'), JSON.stringify(local));
  return root;
}
const run = (root, ...a) => spawnSync('node', [script, ...a], { env: { ...process.env, PERMISSIONS_ROOT: root }, encoding: 'utf8' });
const read = (root) => JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.local.json'), 'utf8'));

test('малый: читает и запускает узлы, правки не разрешает', () => {
  const root = project();
  assert.strictEqual(run(root, 'малый').status, 0);
  const p = read(root).permissions;
  assert.ok(p.allow.includes('Read') && p.allow.includes('Agent(kit)'));
  assert.ok(!p.allow.includes('Edit') && !p.allow.includes('Bash') && !p.defaultMode);
});

test('полный: общий Bash, Edit, Write, Agent; английский псевдоним работает', () => {
  const root = project();
  assert.strictEqual(run(root, 'full').status, 0);
  const p = read(root).permissions;
  for (const e of ['Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'Agent', 'SendMessage']) assert.ok(p.allow.includes(e), e);
  assert.strictEqual(p.defaultMode, 'acceptEdits');
});

test('смена уровня снимает прежнее и не трогает записи человека', () => {
  const root = project({ permissions: { allow: ['Bash(git push*)', 'Read'], deny: ['Bash(rm *)'] }, env: { A: '1' } });
  run(root, 'полный');
  run(root, 'малый');
  const s = read(root);
  assert.ok(s.permissions.allow.includes('Bash(git push*)') && s.permissions.allow.includes('Read'));
  assert.ok(!s.permissions.allow.includes('Bash') && !s.permissions.allow.includes('Write'));
  assert.deepStrictEqual(s.permissions.deny, ['Bash(rm *)']);
  assert.strictEqual(s.env.A, '1');
  assert.strictEqual(s.permissions.defaultMode, undefined);
});

test('--off возвращает файл к записям человека', () => {
  const root = project({ permissions: { allow: ['Read'] } });
  run(root, 'средний');
  run(root, '--off');
  assert.deepStrictEqual(read(root), { permissions: { allow: ['Read'] } });
  assert.ok(!fs.existsSync(path.join(root, '.claude', 'permission-level.state.json')));
});

test('неизвестный уровень — стоп без записи', () => {
  const root = project();
  const r = run(root, 'огромный');
  assert.strictEqual(r.status, 2);
  assert.ok(!fs.existsSync(path.join(root, '.claude', 'settings.local.json')));
});

test('--show называет текущий уровень', () => {
  const root = project();
  run(root, 'средний');
  assert.match(run(root, '--show').stdout, /Текущий уровень: средний/);
});
