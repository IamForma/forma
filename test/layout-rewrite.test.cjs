// layout-rewrite.cjs: git mv + замены по границам слова, исключения, идемпотентность.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gitRun } = require('../scripts/lib/git.cjs');

const LAYOUT = path.join(__dirname, '..', 'scripts', 'layout');
const REWRITE = path.join(LAYOUT, 'layout-rewrite.cjs');
const MAP = path.join(LAYOUT, 'layout-map.json');
const FOREIGN = '.' + 'claude/skills/graph-build'; // не литерал ".claude" в исходнике теста целиком — для читаемости diff'ов

const CODEX_FILE = '.' + 'codex/notes/board-plan.md'; // чужая зона Codex — целиком не трогается
const AGENTS_FILE = '.' + 'agents/plugins/forma/dashboard.md'; // чужая зона Gemini-адаптера
const GEMINI_FILE = 'GEMINI.md'; // отдельный файл чужой зоны

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-rewrite-'));
  const g = (...a) => gitRun(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a);
  assert.equal(gitRun(dir, 'init', '-q').code, 0);
  fs.mkdirSync(path.join(dir, 'dashboard'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'my-dashboard'), { recursive: true });
  fs.mkdirSync(path.join(dir, FOREIGN), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(dir, CODEX_FILE)), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(dir, AGENTS_FILE)), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dashboard', 'file.md'), 'content\n');
  fs.writeFileSync(path.join(dir, 'my-dashboard', 'file.md'), 'content\n');
  fs.writeFileSync(path.join(dir, 'root.md'),
    'ref to `dashboard/generate.js` and ' + FOREIGN + ' and my-dashboard/ok\n' +
    'and run node dashboard/generate.js and npm --prefix dashboard test\n' +
    'but prose mentions the dashboard without any path context here.\n');
  fs.writeFileSync(path.join(dir, CODEX_FILE), 'board dashboard protocol — chужая зона, не трогать\n');
  fs.writeFileSync(path.join(dir, AGENTS_FILE), 'dashboard board — chужая зона, не трогать\n');
  fs.writeFileSync(path.join(dir, GEMINI_FILE), 'dashboard board — chужая зона, не трогать\n');
  g('add', '-A');
  assert.equal(g('commit', '-q', '-m', 'init').code, 0);
  return dir;
}

function run(dir, args) {
  return spawnSync(process.execPath, [REWRITE, ...args], { cwd: dir, encoding: 'utf8' });
}

let dir;
test.before(() => { dir = makeRepo(); });
test.after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

test('--help и без аргументов: подсказка, код не 0 без флагов', () => {
  assert.equal(run(dir, ['--help']).status, 0);
  assert.notEqual(run(dir, []).status, 0);
});

test('--dry: ничего не пишет, отчёт по файлам/заменам, спорные сгруппированы по файлу/слову', () => {
  const before = fs.readFileSync(path.join(dir, 'root.md'), 'utf8');
  const r = run(dir, ['--map', MAP, '--dry']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Файлов для правки: \d+\. Замен: \d+ \(точных: \d+\)\. Спорных \(не тронуты\): \d+ в \d+ файлах\./);
  assert.match(r.stdout, /root\.md: «dashboard» ×1/); // голое слово в прозе — счётчиком, не построчно
  assert.equal(fs.existsSync(path.join(dir, '.forma')), false);
  assert.equal(fs.readFileSync(path.join(dir, 'root.md'), 'utf8'), before);
});

test('--apply: путеподобные совпадения переписаны, голое слово в прозе — нет', () => {
  const r = run(dir, ['--map', MAP, '--apply']);
  assert.equal(r.status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'dashboard')), false);
  assert.equal(fs.existsSync(path.join(dir, '.forma', 'dashboard', 'file.md')), true);
  assert.equal(fs.existsSync(path.join(dir, 'my-dashboard', 'file.md')), true);
  assert.equal(fs.existsSync(path.join(dir, FOREIGN)), true);
  const text = fs.readFileSync(path.join(dir, 'root.md'), 'utf8');
  assert.match(text, /`\.forma\/dashboard\/generate\.js`/); // со слешем/кавычкой — точное
  assert.match(text, new RegExp(FOREIGN.replace(/\./g, '\\.')));
  assert.match(text, /my-dashboard\/ok/);
  assert.match(text, /node \.forma\/dashboard\/generate\.js/); // после `node` — точное
  assert.match(text, /--prefix \.forma\/dashboard test/); // после `--prefix` — точное
  assert.match(text, /mentions the dashboard without any path context here/); // голое слово — не тронуто
});

test('--apply: чужие зоны (.codex/, .agents/, GEMINI.md) целиком не трогаются', () => {
  assert.equal(fs.readFileSync(path.join(dir, CODEX_FILE), 'utf8'), 'board dashboard protocol — chужая зона, не трогать\n');
  assert.equal(fs.readFileSync(path.join(dir, AGENTS_FILE), 'utf8'), 'dashboard board — chужая зона, не трогать\n');
  assert.equal(fs.readFileSync(path.join(dir, GEMINI_FILE), 'utf8'), 'dashboard board — chужая зона, не трогать\n');
});

test('повторный --apply: 0 замен, 0 git mv (идемпотентность); голое слово остаётся спорным', () => {
  const r = run(dir, ['--map', MAP, '--apply']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /git mv: 0\. Файлов изменено: 0\. Замен: 0 \(точных: 0\)\. Спорных \(не тронуты\): \d+\./);
});

test('--map без аргумента и неизвестная таблица — понятная ошибка, код ≠0', () => {
  assert.notEqual(run(dir, ['--dry']).status, 0);
  assert.notEqual(run(dir, ['--map', path.join(dir, 'нет.json'), '--dry']).status, 0);
});

// относительная ссылка между соседями, которые сами переезжают
// в этом же наборе.
test('../dashboard из файла внутри board/ — сосед по переезду, не получает префикс', () => {
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-rewrite-neigh-'));
  const g = (...a) => gitRun(dir2, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a);
  assert.equal(gitRun(dir2, 'init', '-q').code, 0);
  fs.mkdirSync(path.join(dir2, 'board'), { recursive: true });
  fs.mkdirSync(path.join(dir2, 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'dashboard', 'floor.cjs'), "module.exports = {};\n");
  fs.writeFileSync(path.join(dir2, 'board', 'x.cjs'), "require('../dashboard/floor.cjs');\n");
  fs.writeFileSync(path.join(dir2, 'root-ref.md'), 'см. `dashboard/generate.js` из корня\n');
  g('add', '-A'); assert.equal(g('commit', '-q', '-m', 'init').code, 0);
  const r = run(dir2, ['--map', MAP, '--apply']);
  assert.equal(r.status, 0);
  assert.equal(
    fs.readFileSync(path.join(dir2, '.forma', 'board', 'x.cjs'), 'utf8'),
    "require('../dashboard/floor.cjs');\n" // сосед — не тронут
  );
  assert.match(
    fs.readFileSync(path.join(dir2, 'root-ref.md'), 'utf8'),
    /`\.forma\/dashboard\/generate\.js`/ // не-сосед (файл сам не переезжает) — как раньше, переписан
  );
  fs.rmSync(dir2, { recursive: true, force: true });
});

// основа имени файла совпадает со словом переезда ("board.cjs",
// "./data/board.cjs") — это не каталог, не переписывается.
test('имя файла "board.cjs" не принимается за каталог "board"', () => {
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-rewrite-fname-'));
  const g = (...a) => gitRun(dir2, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a);
  assert.equal(gitRun(dir2, 'init', '-q').code, 0);
  fs.mkdirSync(path.join(dir2, 'board'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'board', 'placeholder.cjs'), "module.exports = {};\n");
  fs.writeFileSync(path.join(dir2, 'note.md'), "см. `./data/board.cjs` и просто board.cjs\n");
  g('add', '-A'); assert.equal(g('commit', '-q', '-m', 'init').code, 0);
  const r = run(dir2, ['--map', MAP, '--apply']);
  assert.equal(r.status, 0);
  assert.equal(
    fs.readFileSync(path.join(dir2, 'note.md'), 'utf8'),
    "см. `./data/board.cjs` и просто board.cjs\n"
  );
  fs.rmSync(dir2, { recursive: true, force: true });
});

// git mv падает «source directory is empty», когда индекс пуст — свежий
// `git init` без add/commit (типичный случай для только что созданного проекта старой раскладки).
// Ожидается fs-перенос вместо git mv, без потери содержимого, без падения.
test('--apply в git-репо без коммита (пустой индекс) — fs-перенос вместо git mv, не падает', () => {
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-rewrite-nocommit-'));
  assert.equal(gitRun(dir2, 'init', '-q').code, 0); // git init есть, add/commit нет — индекс пуст
  fs.mkdirSync(path.join(dir2, 'board'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'board', 'placeholder.cjs'), "module.exports = {};\n");
  fs.writeFileSync(path.join(dir2, 'note.md'), "см. `board/placeholder.cjs`\n");
  const r = run(dir2, ['--map', MAP, '--apply']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(fs.existsSync(path.join(dir2, 'board')), false, 'старый «board» остался');
  assert.equal(
    fs.readFileSync(path.join(dir2, '.forma', 'board', 'placeholder.cjs'), 'utf8'),
    "module.exports = {};\n"
  );
  fs.rmSync(dir2, { recursive: true, force: true });
});

// каталог вовсе без .git (git-клиент может быть не вызван, или отсутствовать) —
// listFiles() уже падает в обычный walk; doMoves должен переносить fs-рейком, а не пытаться git mv.
test('--apply без .git вовсе — fs-перенос, не падает', () => {
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-rewrite-nogit-'));
  fs.mkdirSync(path.join(dir2, 'board'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'board', 'placeholder.cjs'), "module.exports = {};\n");
  fs.writeFileSync(path.join(dir2, 'note.md'), "см. `board/placeholder.cjs`\n");
  const r = run(dir2, ['--map', MAP, '--apply']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(fs.existsSync(path.join(dir2, 'board')), false, 'старый «board» остался');
  assert.equal(
    fs.readFileSync(path.join(dir2, '.forma', 'board', 'placeholder.cjs'), 'utf8'),
    "module.exports = {};\n"
  );
  fs.rmSync(dir2, { recursive: true, force: true });
});

// сама таблица переезда и каталог карточки с её копией не правятся.
test('таблица переезда и project/cards/card-*/ исключены автоматически', () => {
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-rewrite-selfmap-'));
  const g = (...a) => gitRun(dir2, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a);
  assert.equal(gitRun(dir2, 'init', '-q').code, 0);
  fs.mkdirSync(path.join(dir2, 'board'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'board', 'placeholder.cjs'), "module.exports = {};\n");
  const mapCopy = { moves: [{ from: 'board', to: '.forma/board' }], exceptions: {} };
  fs.mkdirSync(path.join(dir2, 'my-map'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'my-map', 'layout-map.json'), JSON.stringify(mapCopy, null, 2) + '\n');
  fs.mkdirSync(path.join(dir2, 'project', 'cards', 'card-099'), { recursive: true });
  fs.writeFileSync(path.join(dir2, 'project', 'cards', 'card-099', 'layout-map-099.json'), JSON.stringify(mapCopy, null, 2) + '\n');
  g('add', '-A'); assert.equal(g('commit', '-q', '-m', 'init').code, 0);
  const before = fs.readFileSync(path.join(dir2, 'my-map', 'layout-map.json'), 'utf8');
  const beforeCard = fs.readFileSync(path.join(dir2, 'project', 'cards', 'card-099', 'layout-map-099.json'), 'utf8');
  const r = run(dir2, ['--map', path.join(dir2, 'my-map', 'layout-map.json'), '--apply']);
  assert.equal(r.status, 0);
  assert.equal(fs.readFileSync(path.join(dir2, 'my-map', 'layout-map.json'), 'utf8'), before);
  assert.equal(fs.readFileSync(path.join(dir2, 'project', 'cards', 'card-099', 'layout-map-099.json'), 'utf8'), beforeCard);
  fs.rmSync(dir2, { recursive: true, force: true });
});
