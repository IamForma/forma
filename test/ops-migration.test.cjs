// Служебные файлы (ROADMAP/JOURNAL/VALUE/GLOSSARY) переезжают из project/ в project/ops/: файлы, точные пути, идемпотентность.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const FORMA = path.resolve(__dirname, '..', 'bin', 'forma.cjs');
const OPS = ['ROADMAP.md', 'JOURNAL.md', 'VALUE.md', 'GLOSSARY.md'];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-ops-'));
const init = () => spawnSync(process.execPath, [FORMA, 'init', '--dir', dir, '--engines', 'claude', '--board', 'skip', '--lang', 'en', '--yes'], { encoding: 'utf8' });
const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const has = (rel) => fs.existsSync(path.join(dir, rel));

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('чистая установка кладёт служебные файлы в project/ops/', () => {
  const r = init();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const f of OPS) { assert.ok(has('project/ops/' + f), f); assert.ok(!has('project/' + f), 'старое место: ' + f); }
  assert.match(r.stdout, /перенос служебных файлов в project\/ops\/: не требуется/);
});

test('старая раскладка: файлы переехали, точные пути переписаны, история цела', () => {
  for (const f of OPS) fs.renameSync(path.join(dir, 'project/ops', f), path.join(dir, 'project', f));
  fs.rmSync(path.join(dir, 'project/ops'), { recursive: true });
  const mf = path.join(dir, '.forma/install-manifest.json');
  fs.writeFileSync(mf, fs.readFileSync(mf, 'utf8').replace(/project\/ops\//g, 'project/'));
  fs.writeFileSync(path.join(dir, 'project/docs/note.md'), 'Карта — `project/ROADMAP.md`, журнал — `project/JOURNAL.md`.\n');
  fs.writeFileSync(path.join(dir, '.forma/living/CHANGELOG.md'), 'moved project/VALUE.md earlier\n');

  const r = init();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /перенос служебных файлов в project\/ops\/: /);
  for (const f of OPS) { assert.ok(has('project/ops/' + f), f); assert.ok(!has('project/' + f), 'осталось в старом месте: ' + f); }
  assert.match(read('project/docs/note.md'), /`project\/ops\/ROADMAP\.md`.*`project\/ops\/JOURNAL\.md`/);
  assert.equal(read('.forma/living/CHANGELOG.md'), 'moved project/VALUE.md earlier\n');
});

test('повторная установка: ничего не переносится, сверка зелёная', () => {
  const r = init();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /перенос служебных файлов в project\/ops\/: не требуется/);
  const v = spawnSync(process.execPath, [path.join(dir, '.forma/verify/verify-install.cjs'), '--root', dir], { encoding: 'utf8' });
  assert.equal(v.status, 0, v.stdout + v.stderr);
});

test('читатели находят служебные файлы в обоих местах (запасной старый путь)', () => {
  const { opsFile } = require('../skills/forma/core/dashboard/lib/fs.cjs');
  assert.equal(opsFile(dir, 'ROADMAP.md'), path.join(dir, 'project/ops/ROADMAP.md'));
  const old = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-ops-old-'));
  try {
    fs.mkdirSync(path.join(old, 'project'));
    fs.writeFileSync(path.join(old, 'project/ROADMAP.md'), 'x');
    assert.equal(opsFile(old, 'ROADMAP.md'), path.join(old, 'project/ROADMAP.md'));
  } finally { fs.rmSync(old, { recursive: true, force: true }); }
});
