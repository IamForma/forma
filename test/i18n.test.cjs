// Языковой слой: ключи читаются по якорю или по словарю, сообщения идут из каталога, английский — запасной.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const I18N = path.resolve(__dirname, '..', 'skills', 'forma', 'core', 'i18n');
const i18n = require(path.join(I18N, 'index.cjs'));
const checks = require(path.join(I18N, 'project-checks.cjs'));

const EN = `# Project

**Project language** <!-- k:language -->: English

**Thresholds** <!-- k:thresholds -->

| Name <!-- k:name --> | Value |
| --- | --- |
| Attempts <!-- k:attempts --> | 3 |
| Cycle volume <!-- k:volume --> | not set |
`;
const RU = `# Проект

**Язык проекта**: русский

**Пороги**

| Имя | Значение |
| --- | --- |
| Заходов на задачу | 3 |
| Объём цикла | 5 |
`;
const FR = `# Projet

**Langue du projet** <!-- k:language -->: français

**Seuils** <!-- k:thresholds -->

| Nom <!-- k:name --> | Valeur |
| --- | --- |
| Tentatives <!-- k:attempts --> | 3 |
| Volume du cycle <!-- k:volume --> | 5 |
`;

const project = (md) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-i18n-'));
  fs.mkdirSync(path.join(dir, 'project', 'config'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'project', 'config', 'PROJECT.md'), md);
  return dir;
};
const cli = (dir, ...args) => spawnSync(process.execPath, [path.join(I18N, 'cli.cjs'), ...args, '--root', dir], { encoding: 'utf8', env: { ...process.env, FORMA_LANG: '' } });

test('якорь важнее подписи: французский документ читается без словаря fr', () => {
  const r = i18n.reader(FR);
  assert.equal(r.inline('language'), 'français');
  const t = r.table('thresholds');
  assert.equal(i18n.rowValue(t, 'attempts'), '3');
  assert.equal(i18n.rowValue(t, 'volume'), '5');
});

test('документ без якорей читается по словарю (ru)', () => {
  const r = i18n.reader(RU);
  assert.equal(r.inline('language'), 'русский');
  const t = r.table('thresholds');
  assert.equal(i18n.rowValue(t, 'attempts'), '3');
  assert.equal(i18n.rowValue(t, 'volume'), '5');
});

test('langCode: имя, код, неизвестный язык', () => {
  assert.equal(i18n.langCode('Русский'), 'ru');
  assert.equal(i18n.langCode('en'), 'en');
  assert.equal(i18n.langCode('fr'), 'fr');
  assert.equal(i18n.langCode('français'), null);
  assert.equal(i18n.langCode(''), null);
});

test('message: каталог языка, запасной английский, затем сам код', () => {
  assert.equal(i18n.message('ready.notes_header', { n: 2 }, 'ru'), 'Непроверенных мест: 2');
  assert.equal(i18n.message('ready.notes_header', { n: 2 }, 'fr'), 'Unchecked items: 2');
  assert.equal(i18n.message('no.such.code', {}, 'en'), 'no.such.code');
});

test('язык вывода: поле проекта, FORMA_LANG перекрывает', () => {
  const ru = project(RU), fr = project(FR), en = project(EN);
  try {
    assert.equal(i18n.projectLang(ru), 'ru');
    assert.equal(i18n.projectLang(fr), 'en');
    assert.equal(i18n.projectLang(en), 'en');
    assert.equal(cli(ru, 'lang').stdout.trim(), 'ru');
    const forced = spawnSync(process.execPath, [path.join(I18N, 'cli.cjs'), 'lang', '--root', ru], { encoding: 'utf8', env: { ...process.env, FORMA_LANG: 'en' } });
    assert.equal(forced.stdout.trim(), 'en');
  } finally { for (const d of [ru, fr, en]) fs.rmSync(d, { recursive: true, force: true }); }
});

test('проверка порогов не зависит от языка подписей', () => {
  const dirs = { en: project(EN), ru: project(RU.replace('| Объём цикла | 5 |', '| Объём цикла | не задан |')), fr: project(FR.replace('| Volume du cycle <!-- k:volume --> | 5 |', '| Volume du cycle <!-- k:volume --> | not set |')) };
  try {
    for (const [lang, dir] of Object.entries(dirs)) {
      assert.ok(checks.readyNotes(dir).some((n) => n.code === 'ready.thresholds_incomplete'), lang);
      assert.ok(checks.startGate(dir).some((n) => n.code === 'gate.thresholds'), lang);
    }
    assert.match(cli(dirs.ru, 'gate').stdout, /ПОРОГИ|порог|СТОП/i);
    assert.match(cli(dirs.fr, 'gate').stdout, /both thresholds must be set/);
  } finally { for (const d of Object.values(dirs)) fs.rmSync(d, { recursive: true, force: true }); }
});

test('заполненные пороги: стоп по порогам не срабатывает ни на одном языке', () => {
  for (const md of [RU, FR]) {
    const dir = project(md);
    try { assert.ok(!checks.startGate(dir).some((n) => n.code === 'gate.thresholds')); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

test('каталоги сообщений: у каждого языка те же коды, что у английского', () => {
  const dir = path.join(I18N, 'messages');
  const en = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'))).filter((k) => !k.startsWith('_'));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter((k) => !k.startsWith('_'));
    assert.deepEqual(keys.sort(), [...en].sort(), f);
  }
});

test('установщик: i18n доставлен, шаблон с якорями, старый ru-проект получает якоря один раз', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-i18n-init-'));
  const forma = path.resolve(__dirname, '..', 'bin', 'forma.cjs');
  const init = () => spawnSync(process.execPath, [forma, 'init', '--dir', dir, '--engines', 'claude', '--board', 'skip', '--lang', 'en', '--yes'], { encoding: 'utf8' });
  try {
    const first = init();
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.ok(fs.existsSync(path.join(dir, '.forma', 'i18n', 'index.cjs')));
    const file = path.join(dir, 'project', 'config', 'PROJECT.md');
    assert.match(fs.readFileSync(file, 'utf8'), /<!-- k:thresholds -->/);
    assert.match(first.stdout, /PROJECT\.md anchors: no PROJECT\.md/);

    fs.writeFileSync(file, RU);
    const second = init();
    assert.match(second.stdout, /PROJECT\.md anchors: added/);
    const migrated = fs.readFileSync(file, 'utf8');
    assert.match(migrated, /Заходов на задачу <!-- k:attempts -->/);
    assert.equal(i18n.anchorise(migrated), migrated);
    assert.match(init().stdout, /PROJECT\.md anchors: already in place/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('хуки: один и тот же стоп на en, ru и французском документе; вывод — язык проекта, запасной английский', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-i18n-hook-'));
  const forma = path.resolve(__dirname, '..', 'bin', 'forma.cjs');
  const r = spawnSync(process.execPath, [forma, 'init', '--dir', dir, '--engines', 'claude', '--board', 'skip', '--lang', 'en', '--yes'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const file = path.join(dir, 'project', 'config', 'PROJECT.md');
  const original = fs.readFileSync(file, 'utf8');
  const hook = (name, input) => spawnSync('bash', [path.join(dir, '.claude', 'hooks', name)], { cwd: dir, encoding: 'utf8', input, env: { ...process.env, CLAUDE_PROJECT_DIR: dir, FORMA_LANG: '' } });
  try {
    assert.match(hook('check-ready.sh').stdout, /START STOP/);

    fs.writeFileSync(file, original.replace(/(\*\*Project language\*\*[^\n]*?\)\*?:\s*)English\./, '$1Русский.'));
    assert.match(hook('check-ready.sh').stdout, /СТОП СТАРТА/);

    fs.writeFileSync(file, original.replace(/(\*\*Project language\*\*[^\n]*?\)\*?:\s*)English\./, '$1français.').replace('**Thresholds**', '**Seuils**').replace('| Attempts per task', '| Tentatives par tâche'));
    assert.match(hook('check-ready.sh').stdout, /START STOP/);

    // the reason of a blocked delete: the project language, and the code phrase stays literal in both
    const reason = spawnSync(process.execPath, [path.join(dir, '.forma', 'i18n', 'cli.cjs'), 'msg', 'hook.delete_blocked', 'cmd=rm x', '--root', dir], { encoding: 'utf8', env: { ...process.env, FORMA_LANG: 'en' } }).stdout;
    assert.match(reason, /Blocked by the guard-delete hook.*(rm x).*"Отключи сенсорику"/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
