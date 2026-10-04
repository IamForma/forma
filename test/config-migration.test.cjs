// Конфигурация проекта переезжает из project/ в project/config/: файлы, точные пути в тексте, идемпотентность.
// История (карточки, JOURNAL/CHANGELOG) не переписывается; сверка установки после переезда зелёная.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const FORMA = path.resolve(__dirname, '..', 'bin', 'forma.cjs');
const CONFIG = ['PROJECT.md', 'CONFIG.md', 'SETUP.md', 'ROUTE.md'];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-config-'));
const init = () => spawnSync(process.execPath, [FORMA, 'init', '--dir', dir, '--engines', 'claude', '--board', 'skip', '--lang', 'en', '--yes'], { encoding: 'utf8' });
const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const has = (rel) => fs.existsSync(path.join(dir, rel));

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('чистая установка кладёт конфигурацию в project/config/', () => {
  const r = init();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const f of CONFIG) { assert.ok(has('project/config/' + f), f); assert.ok(!has('project/' + f), 'старое место: ' + f); }
  assert.match(r.stdout, /перенос конфигурации в project\/config\/: не требуется/);
});

test('старая раскладка: файлы переехали, точные пути в тексте переписаны, история цела', () => {
  for (const f of CONFIG) fs.renameSync(path.join(dir, 'project/config', f), path.join(dir, 'project', f));
  fs.rmSync(path.join(dir, 'project/config'), { recursive: true });
  // опись, записанная до переезда, ведёт скелет по старым путям
  const mf = path.join(dir, '.forma/install-manifest.json');
  fs.writeFileSync(mf, fs.readFileSync(mf, 'utf8').replace(/project\/config\//g, 'project/'));
  fs.writeFileSync(path.join(dir, 'project/docs/note.md'), 'Пороги — в `project/PROJECT.md`, порядок — `project/SETUP.md`.\n');
  fs.mkdirSync(path.join(dir, '.devtool/features'), { recursive: true });
  const card = ['---', 'id: "fixture-old"', 'status: "backlog"', 'priority: "medium"', 'assignee: null', 'epic: "3. Form/Intent+Kit"', 'dueDate: null',
    'created: "2026-01-01T00:00:00.000Z"', 'modified: "2026-01-01T00:00:00.000Z"', 'completedAt: null', 'labels: ["goal-forma", "route-4"]', 'order: "a0"', '---',
    '# Old fixture', '', '## Task', '1 · tooling | x | y | 1 | none', '', '## Kit', '', '## History', '- see project/PROJECT.md', '', '## Result', ''].join('\n');
  fs.writeFileSync(path.join(dir, '.devtool/features/fixture-old.md'), card);
  fs.writeFileSync(path.join(dir, '.forma/living/CHANGELOG.md'), 'moved project/CONFIG.md earlier\n');

  const r = init();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /перенос конфигурации в project\/config\/: PROJECT\.md/);
  for (const f of CONFIG) { assert.ok(has('project/config/' + f), f); assert.ok(!has('project/' + f), 'осталось в старом месте: ' + f); }
  assert.match(read('project/docs/note.md'), /`project\/config\/PROJECT\.md`.*`project\/config\/SETUP\.md`/);
  assert.equal(read('.devtool/features/fixture-old.md'), card, 'карточка — история, не переписывается');
  assert.equal(read('.forma/living/CHANGELOG.md'), 'moved project/CONFIG.md earlier\n');
});

test('повторная установка: ничего не переносится, сверка зелёная', () => {
  const r = init();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /перенос конфигурации в project\/config\/: не требуется/);
  const v = spawnSync(process.execPath, [path.join(dir, '.forma/verify/verify-install.cjs'), '--root', dir], { encoding: 'utf8' });
  assert.equal(v.status, 0, v.stdout + v.stderr);
});

test('читатели находят конфигурацию в обоих местах (запасной старый путь)', () => {
  const { projectFile } = require('../skills/forma/core/dashboard/lib/fs.cjs');
  assert.equal(projectFile(dir, 'PROJECT.md'), path.join(dir, 'project/config/PROJECT.md'));
  const old = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-config-old-'));
  fs.mkdirSync(path.join(old, 'project'));
  fs.writeFileSync(path.join(old, 'project/PROJECT.md'), 'x');
  assert.equal(projectFile(old, 'PROJECT.md'), path.join(old, 'project/PROJECT.md'));
  fs.rmSync(old, { recursive: true, force: true });
});
