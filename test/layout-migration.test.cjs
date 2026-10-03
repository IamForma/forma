// forma init: проект старой раскладки (board/dashboard/living/manual/skills/templates/protocol
// в корне) переносится в `.forma/` сам, идемпотентно, без потери файлов пользователя.
// Фикстура — test/fixture/old-layout/ (минимальная стойка, не копия настоящего релиза 0.4.x).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { gitRun } = require('../scripts/lib/git.cjs');

const PKG = path.join(__dirname, '..');
const FORMA_BIN = path.join(PKG, 'bin', 'forma.cjs');
const FIXTURE = path.join(PKG, 'test', 'fixture', 'old-layout');
const MOVED_DIRS = ['board', 'dashboard', 'living', 'manual', 'skills', 'templates', 'protocol'];

function copyTree(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyTree(s, d); }
    else fs.copyFileSync(s, d);
  }
}

// Изолированный HOME: сборка не видит ~/.claude и ~/.claude.json машины (как в helpers/fixture.cjs).
function isolatedEnv(home) {
  return { ...process.env, HOME: home, USERPROFILE: home, HOMEDRIVE: '', HOMEPATH: '' };
}

function hashTree(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  const walk = (abs, rel) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const a = path.join(abs, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(a, r);
      else out[r] = crypto.createHash('sha256').update(fs.readFileSync(a)).digest('hex');
    }
  };
  walk(dir, '');
  return out;
}

// mode: 'committed' (по умолчанию, как ставился набор карточек) | 'uncommitted' (`git init` без
// add/commit — пустой индекс, типичный случай для только что созданного проекта) | 'nogit' (без
// .git вовсе; `forma init` сам вызовет `git init` через gitBoundary, индекс будет пуст так же,
// как в 'uncommitted').
function makeProject(mode = 'committed') {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-oldlayout-'));
  const root = path.join(base, 'project');
  const home = path.join(base, 'home');
  fs.mkdirSync(home);
  fs.mkdirSync(root);
  copyTree(FIXTURE, root);
  if (mode !== 'nogit') {
    assert.equal(gitRun(root, 'init', '-q').code, 0);
    if (mode === 'committed') {
      const g = (...a) => gitRun(root, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a);
      assert.equal(g('add', '-A').code, 0);
      assert.equal(g('commit', '-q', '-m', 'old layout').code, 0);
    }
  }
  return { base, root, home, env: isolatedEnv(home), cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

function init(px) {
  return spawnSync(process.execPath, [FORMA_BIN, 'init', '--dir', px.root,
    '--engines', 'claude', '--template', 'none', '--board', 'skip', '--yes'],
  { encoding: 'utf8', env: px.env, timeout: 180000, maxBuffer: 1 << 24 });
}

let px, beforeProject, beforeDevtool, r1;
test.before(() => {
  px = makeProject();
  beforeProject = hashTree(path.join(px.root, 'project'));
  beforeDevtool = hashTree(path.join(px.root, '.devtool'));
  r1 = init(px);
});
test.after(() => { if (px) px.cleanup(); });

test('init упал бы с кодом ≠0, если что-то пошло не так', () => {
  assert.equal(r1.status, 0, r1.stdout + r1.stderr);
});

test('старые корневые каталоги перенесены в .forma/, project/ и .devtool/ байт-в-байт те же', () => {
  for (const d of MOVED_DIRS) {
    assert.equal(fs.existsSync(path.join(px.root, d)), false, `старый корень «${d}» остался`);
    assert.equal(fs.existsSync(path.join(px.root, '.forma', d)), true, `.forma/${d} не создан`);
  }
  assert.deepEqual(hashTree(path.join(px.root, 'project')), beforeProject, 'project/ изменился при миграции');
  assert.deepEqual(hashTree(path.join(px.root, '.devtool')), beforeDevtool, '.devtool/ изменился при миграции');
});

test('содержимое living/ сохранено', () => {
  assert.match(
    fs.readFileSync(path.join(px.root, '.forma', 'living', 'JOURNAL.md'), 'utf8'),
    /запись журнала старой раскладки/
  );
  assert.match(
    fs.readFileSync(path.join(px.root, '.forma', 'living', 'CHANGELOG.md'), 'utf8'),
    /запись в истории старой раскладки/
  );
});

test('файл пользователя из старого dashboard/ не утерян и назван в отчёте первого запуска', () => {
  assert.equal(
    fs.readFileSync(path.join(px.root, '.forma', 'dashboard', 'my-notes.md'), 'utf8'),
    'Личный файл пользователя, положенный прямо в `.forma/dashboard/` — миграция не должна его терять.\n'
  );
  assert.match(r1.stdout, /\.forma\/dashboard\/my-notes\.md/, 'файл пользователя не назван в отчёте');
});

test('повторный запуск печатает «ничего не изменено»', () => {
  const r2 = init(px);
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  assert.match(r2.stdout, /перенос со старой раскладки: не требуется \(ничего не изменено\)/);
});

// та же фикстура, но git-репо без коммита (пустой индекс) — типичный случай
// для только что созданного проекта старой раскладки. Раньше падало «source directory is empty».
test('git-репо без коммита — перенос не падает, содержимое и отчёт сохранены', () => {
  const px2 = makeProject('uncommitted');
  try {
    const r = init(px2);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const d of MOVED_DIRS) {
      assert.equal(fs.existsSync(path.join(px2.root, d)), false, `старый корень «${d}» остался`);
      assert.equal(fs.existsSync(path.join(px2.root, '.forma', d)), true, `.forma/${d} не создан`);
    }
    assert.equal(
      fs.readFileSync(path.join(px2.root, '.forma', 'dashboard', 'my-notes.md'), 'utf8'),
      'Личный файл пользователя, положенный прямо в `.forma/dashboard/` — миграция не должна его терять.\n'
    );
    assert.match(r.stdout, /\.forma\/dashboard\/my-notes\.md/, 'файл пользователя не назван в отчёте');
    const r2 = init(px2);
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    assert.match(r2.stdout, /перенос со старой раскладки: не требуется \(ничего не изменено\)/);
  } finally { px2.cleanup(); }
});

// фикстура вовсе без .git — `gitBoundary` сам делает `git init` без коммита,
// так что на входе в migrateLayout индекс пуст тем же способом, что и в режиме 'uncommitted'.
test('фикстура без .git вовсе — перенос не падает, содержимое сохранено', () => {
  const px3 = makeProject('nogit');
  try {
    const r = init(px3);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    for (const d of MOVED_DIRS) {
      assert.equal(fs.existsSync(path.join(px3.root, d)), false, `старый корень «${d}» остался`);
      assert.equal(fs.existsSync(path.join(px3.root, '.forma', d)), true, `.forma/${d} не создан`);
    }
  } finally { px3.cleanup(); }
});
