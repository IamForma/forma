'use strict';
// Сверка схемы движка с ENGINE-MAP (ru и en): каждое названное имя есть на диске и лежит ровно в одном блоке,
// каждый файл движка описан блоком; новый неописанный файл или имя без файла — красный результат с адресом.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildSchema } = require('./schema.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const LIVE = { skip: !(fs.existsSync(path.join(ROOT, 'AGENTS.md')) && fs.existsSync(path.join(ROOT, '.claude/settings.json'))) && 'not a project root' };

// Имена, которые ENGINE-MAP называет, а в шаблоне движка файла нет: их создаёт проект, а не протокол.
// Список закрытый; имя из него, которое появилось на диске, тоже красное (убрать из списка).
const PROJECT_MADE = new Set(['project/extensions/', 'credentials.md', 'VARS/credentials.md']);

// Чистая сверка: схема -> список проблем, у каждой адрес.
function reconcile(schema, allowed) {
  const problems = [];
  const owners = new Map();
  for (const b of schema.blocks) for (const f of b.files) {
    if (!owners.has(f)) owners.set(f, []);
    owners.get(f).push(b.key);
  }
  for (const f of schema.files) {
    const o = owners.get(f.path) || [];
    if (o.length === 0) problems.push(`no block: ${f.path}`);
    if (o.length > 1) problems.push(`in ${o.length} blocks (${o.join(', ')}): ${f.path}`);
  }
  for (const u of schema.unsorted) problems.push(`unsorted: ${u}`);
  for (const u of schema.engineMap.unresolved) {
    if (!allowed.has(u.token)) problems.push(`ENGINE-MAP ${u.lang}: no such file on disk: ${u.token}`);
  }
  for (const r of schema.engineMap.resolved) {
    if (allowed.has(r.token)) problems.push(`ENGINE-MAP ${r.lang}: ${r.token} exists now, remove from the project-made list`);
    if (r.file && !owners.has(r.file)) problems.push(`ENGINE-MAP ${r.lang}: ${r.token} -> ${r.file} is in no block`);
  }
  return problems;
}

function tmpProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engmap-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

test('ENGINE-MAP exists in ru and en and both are read', LIVE, () => {
  for (const lang of ['ru', 'en']) {
    assert.ok(fs.existsSync(path.join(ROOT, `.forma/manual/${lang}/03-protocol/ENGINE-MAP.md`)), lang);
  }
  const s = buildSchema(ROOT);
  for (const lang of ['ru', 'en']) {
    assert.ok(s.engineMap.resolved.some((r) => r.lang === lang), 'no tokens read from ' + lang);
  }
});

test('live engine: every file in one block, every ENGINE-MAP name on disk', LIVE, () => {
  const problems = reconcile(buildSchema(ROOT), PROJECT_MADE);
  assert.deepEqual(problems, [], '\n' + problems.join('\n'));
});

test('a new undescribed file turns the check red with its address, and green once removed', () => {
  const base = { 'AGENTS.md': '# law\n', '.claude/settings.json': '{}' };
  assert.deepEqual(reconcile(buildSchema(tmpProject(base)), new Set()), []);
  const dir = tmpProject({ ...base, '.codex/zz-new-file.dat': 'x' });
  const red = reconcile(buildSchema(dir), new Set());
  assert.ok(red.includes('unsorted: .codex/zz-new-file.dat'), red.join('\n'));
  fs.rmSync(path.join(dir, '.codex/zz-new-file.dat'));
  assert.deepEqual(reconcile(buildSchema(dir), new Set()), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a name in ENGINE-MAP without a file is red with lang and name; present file is green', () => {
  const map = (n) => `# map\n\`${n}\`\n`;
  const files = (extra) => ({
    'AGENTS.md': '# law\n',
    '.forma/manual/ru/03-protocol/ENGINE-MAP.md': map('.claude/scripts/ghost.cjs'),
    '.forma/manual/en/03-protocol/ENGINE-MAP.md': map('.claude/scripts/ghost.cjs'),
    ...extra,
  });
  const dir = tmpProject(files());
  const red = reconcile(buildSchema(dir), new Set());
  assert.ok(red.includes('ENGINE-MAP ru: no such file on disk: .claude/scripts/ghost.cjs'), red.join('\n'));
  assert.ok(red.includes('ENGINE-MAP en: no such file on disk: .claude/scripts/ghost.cjs'), red.join('\n'));
  fs.mkdirSync(path.join(dir, '.claude/scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude/scripts/ghost.cjs'), '// ghost\n');
  const after = reconcile(buildSchema(dir), new Set());
  assert.ok(!after.some((p) => p.startsWith('ENGINE-MAP')), after.join('\n'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a file in two blocks is red with its address', () => {
  const s = buildSchema(tmpProject({ 'AGENTS.md': '# law\n' }));
  s.blocks.find((b) => b.key !== 'rules').files.push('AGENTS.md');
  const red = reconcile(s, new Set());
  assert.ok(red.some((p) => /^in 2 blocks .*: AGENTS\.md$/.test(p)), red.join('\n'));
});
