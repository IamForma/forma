#!/usr/bin/env node
// Локальный сервер дашборда — статика + живой пересчёт data.json + SSE-пуш в браузер.
// Без внешних зависимостей: только встроенные http/fs. file:// не отдаёт index.html
// подтянуть data.json (CORS), поэтому нужен хоть какой-то HTTP-сервер, пусть и локальный.
//
// Запуск: node .forma/dashboard/serve.js  →  обычно http://localhost:5050/, порт динамический —
// см. «Выбор порта» ниже (у каждого проекта свой дашборд, 5050 не гарантирован свободным).
//
// Реального времени добивается так: fs.watch следит за .devtool/features/ рекурсивно;
// любое изменение карточки (правка узлом, перенос в done/, новая карточка) с задержкой
// в 300 мс (чтобы не пересчитывать по три раза за один Write-тулкол) пересобирает срез
// в памяти и рассылает событие всем открытым вкладкам через Server-Sent Events —
// браузер сам обновляет данные, без F5 и без ручного `node generate.js`.
//
// Маршруты — таблица ROUTES ниже: «метод + путь → функция». Всё, чего в ней нет, отдаётся как статика.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { writeJsonAtomic } = require('./lib/fs.cjs');
const i18n = require('./lib/i18n.cjs');
const { DEFAULT_PORT } = require('./port.cjs');

const ROOT = __dirname;
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const FEATURES_DIR = path.join(PROJECT_ROOT, '.devtool', 'features');
const GRAPHIFY_LOG = path.join(__dirname, 'graphify.log');
const BRIEF_DIR = path.join(PROJECT_ROOT, 'project', 'brief');
const ANSWERS_FILE = path.join(BRIEF_DIR, 'answers.jsonl');
// Материалы брифа: сюда переезжает всё, что человек приложил в интервью.
const MATERIALS_DIR = path.join(BRIEF_DIR, 'materials');
const GRILL_SERVER = path.join(PROJECT_ROOT, '.forma/skills', 'forma-grill-with-ui', 'server.mjs');
const CACHE_DIR = path.join(__dirname, '.cache');
const DATA_CACHE_FILE = path.join(CACHE_DIR, 'data.json');
const SERVER_FILE = path.join(CACHE_DIR, 'server.json');
const DEBOUNCE_MS = 300;
const GRILL_WAIT_MS = 8000;              // сколько ждать, пока страница интервью поднимется
const MAX_ANSWER_BYTES = 256 * 1024;     // ответ человека, не файл

fs.mkdirSync(CACHE_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// ---------- перечитываемые модули ----------
//
// Сборщик данных и всё, что он читает (.forma/dashboard/generate.js, data/, lib/), а также модуль сессий интервью
// живут в объекте `live`: правка любого из них доходит до работающего сервера сама, см. watchModules.
// Обращаться к ним надо через `live.<имя>` в момент вызова, не сохраняя ссылку на модуль в константе.
function loadLive() {
  return {
    buildData: require('./generate.js').buildData,
    sessions: require('./lib/interview-sessions.cjs'),
    graphifyTrigger: require('./graphify-trigger.cjs'),
  };
}
let live = loadLive();

let latestData = live.buildData(PROJECT_ROOT);
const sseClients = new Set();

function rebuild(reason) {
  try {
    latestData = live.buildData(PROJECT_ROOT);
    // Держим кэш на диске синхронным — совместимость с ручным чтением/сборкой.
    fs.writeFileSync(DATA_CACHE_FILE, JSON.stringify(latestData, null, 2), 'utf8');
    console.log(`[${new Date().toLocaleTimeString('ru-RU')}] пересобрано (${reason}): карточек ${latestData.totals.cardCount}, токенов по движкам ${JSON.stringify(latestData.totals.tokensByEngine)}`);
    try { live.graphifyTrigger.check(); } catch (err) { console.error('graphify-trigger:', err.message); }
    for (const res of sseClients) {
      res.write(`data: ${JSON.stringify(latestData)}\n\n`);
    }
  } catch (err) {
    console.error('Ошибка пересборки:', err.message);
  }
}

// ---------- сессии интервью ----------

// Распечатывает завершённую сессию: новый вопрос значит, что разговор продолжается.
// Запись прошлого захода не теряется — она уходит в список завершённых кругов, и по
// нему потом видно, что этот разговор уже один раз сдавался.
function reopen(state) {
  if (state.finished) {
    state.finishedRounds = [...(state.finishedRounds || []), state.finished];
    delete state.finished;
  }
  state.agent = { ...(state.agent || {}), status: 'waiting', since: new Date().toISOString() };
}

// Ищет узел в дереве картины и попутно запоминает, к какой позиции он относится.
// Позиция написана не на каждом узле, а на предках — берём ближайшую сверху.
function findNode(node, id, position) {
  if (!node) return null;
  const mine = /позиция\s*(\d)/.exec(String(node.from || '') + ' ' + String(node.tag || ''));
  const pos = mine ? Number(mine[1]) : position;
  if (node.id === id) return { node, position: pos || 1 };
  for (const c of node.children || []) {
    const hit = findNode(c, id, pos);
    if (hit) return hit;
  }
  return null;
}

// Вопрос из узла: его же слова в кавычках и просьба раскрыть. Ни одного слова о том,
// что этот узел, по-моему, значит, — иначе человек будет соглашаться с моим чтением
// вместо того, чтобы рассказывать своё (`project/brief/picture.md`).
// `n` — сколько раскруток в этой сессии уже было: имя выходит коротким и по порядку.
// Узел записан отдельным полем, а не втиснут в имя: имя видно в узкой колонке списка,
// и набивать его содержимым значит ломать список ради того, что там всё равно не прочесть.
const expandQuestion = (node, n) => ({
  id: 'x-' + (n + 1),
  node: node.id,
  title: 'Подробнее',
  text: 'В дереве это записано так: «' + node.label + '». Раскройте этот пункт: что за ним стоит, '
      + 'как он выглядит на деле, чего в нём не хватает. Дальше пойду вопросами по вашему ответу.',
});

// Заход, которым возобновляют закрытую позицию: один открытый вопрос и ничего больше.
//
// Подсказывать здесь нечего. Что человек хочет добавить, знает только он; список
// готовых тем был бы моим замыслом, поданным ему на одобрение, — ровно то, чего
// избегает первый заход (`project/brief/picture.md`).
const resumeQuestions = (position) => [{
  id: `p${position}-r${Date.now().toString(36)}`,
  title: 'Что ещё обсудить',
  text: 'Эта позиция была закрыта, но закрыта не навсегда. Что вы хотели бы добавить, '
      + 'поправить или обсудить заново? Можно одним словом — дальше раскручу вопросами.',
}];

// Вопросы, которыми засевается новый заход позиции: ровно те, что записаны в `OPENING_ROUND`
// и названы человеком годными. Это перенос готового текста, а не авторство, —
// иначе дашборд писал бы `state.json`, который по договору скилла принадлежит
// агенту, и разговор вёл бы не тот, кто за него отвечает.
const openingQuestions = (position) => {
  const interview = latestData.interview;
  const hit = interview && (interview.positions || []).find((p) => p.n === position);
  return (hit || {}).questions || [];
};

const readState = (session) => JSON.parse(fs.readFileSync(path.join(session, 'state.json'), 'utf8'));
const writeState = (session, state) => fs.writeFileSync(path.join(session, 'state.json'), JSON.stringify(state, null, 2), 'utf8');

// Первый заход открытый: `options` нет намеренно. Варианты придумывает агент,
// и опрос с готовыми вариантами записал бы в бриф его замысел, одобренный
// человеком, вместо замысла человека (`project/brief/picture.md`).
function seedQuestions(session, questions) {
  const state = readState(session);
  state.note = 'Первый заход открытый: отвечайте своими словами. Можно ответить не на все.';
  state.questions = questions.map((q, i) => ({
    id: q.id, round: 1, deps: [],
    // Имя для бокового списка страницы: «Вопрос 1» там ничего не говорит,
    // а по списку человек выбирает, к чему вернуться.
    title: q.title || `Вопрос ${i + 1}`, body: q.text,
    options: [], status: 'open', durable: false, updated: false,
  }));
  state.agent = { status: 'waiting', since: new Date().toISOString(), handled: 0 };
  writeState(session, state);
}

// Новая папка сессии от скилла; заход дописывается в карту позиции — прошлые остаются в списке:
// по ним считается, что уже спрошено.
function createGrillSession(position, questions) {
  const out = execFileSync(process.execPath, [
    GRILL_SERVER, 'new',
    '--topic', `Интервью к брифу — позиция ${position}`,
    '--doc', 'project/brief/interview.md',
  ], { cwd: PROJECT_ROOT, encoding: 'utf8' });
  const session = JSON.parse(out.trim().split('\n').pop()).session;
  const { readSessions, writeSessions, sessionList } = live.sessions;
  const all = readSessions(PROJECT_ROOT);
  all[String(position)] = [...sessionList(all[String(position)]), session];
  writeSessions(PROJECT_ROOT, all);
  seedQuestions(session, questions);
  return session;
}

// Сервер страницы — отдельный процесс и переживает этот. Если он уже жив,
// второй не поднимаем: две страницы одной сессии разошлись бы.
function startGrillServer(session) {
  if (live.sessions.serverOf(session).alive) return;
  const child = spawn(process.execPath, [GRILL_SERVER, 'serve', '--session', session],
    { cwd: PROJECT_ROOT, detached: true, stdio: 'ignore' });
  child.unref();
}

// Поднимает (или находит) сессию интервью для позиции и возвращает её папку.
// `resume` — позиция закрыта, и прошлый разговор дописывать нельзя: он записан и
// сдан. Возобновление всегда заводит новый заход, а старая сессия остаётся как есть.
function ensureGrillSession(position, questions, resume) {
  const { readSessions, currentSession } = live.sessions;
  let session = resume ? null : currentSession(readSessions(PROJECT_ROOT)[String(position)]);
  if (!session || !fs.existsSync(path.join(session, 'state.json'))) {
    session = createGrillSession(position, questions);
  }
  startGrillServer(session);
  return session;
}

function grillUrl(session, deadlineMs) {
  const until = Date.now() + deadlineMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const { url, alive } = live.sessions.serverOf(session);
      if (url && alive) return resolve(url);
      if (Date.now() >= until) return reject(new Error('the interview page did not start'));
      setTimeout(tick, 120);
    };
    tick();
  });
}

// ---------- перенос ответов из сессий в бриф ----------
//
// Страница интервью пишет свои отправки в `events.jsonl` сессии. Оттуда сказанное
// переносится в `project/brief/answers.jsonl` — дословно и внутри брифа, потому что
// запись разговора принадлежит проекту, а не папке сессии скилла, которую однажды
// подчистят.
//
// Картину этот перенос не трогает: `picture.json` — синтез `Intent`, и собрать её
// автоматически из сырого ответа значило бы выдать услышанное за понятое.
// Докуда перенесено — на диске, а не в памяти процесса: отметка в памяти
// обнулялась при перезапуске, и каждый запуск дописывал в бриф все прежние
// ответы заново. `sessions.json` для этого и годится — он машинный и вне git.
const watchedSessions = new Set();   // за какими сессиями уже следим в этом процессе

// Переносит один файл в brief/materials и возвращает путь от корня проекта.
// Тёзка не затирается: два разных «бриф.md» из разных сессий — обычное дело.
function absorbUpload(session, name) {
  const from = path.join(session, 'uploads', name);
  if (!fs.existsSync(from)) return null;
  const dir = MATERIALS_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let out = name;
  let i = 1;
  while (fs.existsSync(path.join(dir, out))) {
    // Тот же файл, уже перенесённый, переносить второй раз незачем.
    if (fs.statSync(path.join(dir, out)).size === fs.statSync(from).size) break;
    out = `${stem}-${++i}${ext}`;
  }
  const to = path.join(dir, out);
  if (!fs.existsSync(to)) fs.copyFileSync(from, to);
  console.log(`[интервью] приложен файл: ${out}`);
  return path.relative(PROJECT_ROOT, to).split(path.sep).join('/');
}

// Записи для answers.jsonl из одного события страницы.
function recordsOf(ev, session, position) {
  const at = ev.at || new Date().toISOString();
  const actions = ev.actions || [];
  const records = [];

  // Берём только ответы. Треды, defer, reopen и visualize — разговор про
  // разговор; в дословную запись они не идут, иначе бриф перестанет быть
  // записью сказанного о предмете.
  const answers = actions
    .filter((a) => a.type === 'answer')
    .map((a) => ({ id: String(a.q || ''), text: String(a.text || '').trim() }))
    .filter((a) => a.id && a.text);
  if (answers.length) records.push({ at, position, answers });

  // Приложенные файлы. Их не пересказывают словами — их переносят и называют.
  for (const a of actions.filter((x) => x.type === 'upload' && x.file)) {
    const moved = absorbUpload(session, a.file);
    if (!moved) continue;
    records.push({
      at, position,
      answers: [{
        id: String(a.q || ''),
        text: '',
        file: moved,
        bytes: Number(a.bytes) || 0,
        ...(a.note ? { note: String(a.note) } : {}),
      }],
    });
  }
  return records;
}

function appendAnswerRecords(records, position) {
  try {
    fs.mkdirSync(BRIEF_DIR, { recursive: true });
    fs.appendFileSync(ANSWERS_FILE, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
    console.log(`[интервью] позиция ${position}: перенесено ответов ${records.reduce((n, r) => n + r.answers.length, 0)}`);
  } catch (err) {
    console.error('Перенос ответов не удался:', err.message);
  }
}

function absorbSessionEvents(session, position) {
  let lines;
  try { lines = fs.readFileSync(path.join(session, 'events.jsonl'), 'utf8').split(/\r?\n/); } catch { return; }

  const seen = live.sessions.readAbsorbedSeq(PROJECT_ROOT, session);
  let maxSeq = seen;
  const records = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let ev;
    try { ev = JSON.parse(t); } catch { continue; }   // оборванная строка — пропускаем
    const seq = Number(ev.seq) || 0;
    if (seq <= seen) continue;
    maxSeq = Math.max(maxSeq, seq);
    records.push(...recordsOf(ev, session, position));
  }

  if (maxSeq > seen) live.sessions.writeAbsorbedSeq(PROJECT_ROOT, session, maxSeq);
  if (records.length) appendAnswerRecords(records, position);
}

function watchSessionEvents(session, position) {
  if (watchedSessions.has(session)) return;   // уже следим
  watchedSessions.add(session);
  absorbSessionEvents(session, position);     // догоняем то, что уже отправлено
  try {
    fs.watch(session, (eventType, filename) => {
      if (filename && path.basename(filename) !== 'events.jsonl') return;
      absorbSessionEvents(session, position);
    });
    console.log(`Слежение включено: сессия интервью позиции ${position}`);
  } catch (err) {
    console.log(`Слежение за сессией интервью недоступно (${err.message}).`);
  }
}

// Сессии, заведённые в прошлый запуск, подхватываются: человек мог ответить,
// пока сервер дашборда был выключен, и эти ответы не должны пропасть.
// Следим за всеми заходами позиции — ответить он мог в любом из них.
function resumeSessionWatchers() {
  for (const { position, dirs } of live.sessions.positionSessions(PROJECT_ROOT)) {
    for (const session of dirs) {
      if (fs.existsSync(session)) watchSessionEvents(session, position);
    }
  }
}

// ---------- слежение: пересборка по изменениям на диске ----------

let debounceTimer = null;
function scheduleRebuild(reason) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => rebuild(reason), DEBOUNCE_MS);
}

// Правка сборщика или любого модуля дашборда доходит до работающего сервера сама.
//
// Перезапуск руками — не решение: он требует помнить, что правка вообще была, и
// расплачивается тем, что доска на секунду пропадает. Здесь модули каталога дашборда
// (кроме самого сервера) выбрасываются из кэша и читаются заново, а если новая правка
// сломана — прежние остаются в силе и об этом сказано вслух, вместо того чтобы уронить сервер.
const isReloadable = (file) => file.startsWith(ROOT + path.sep) && file !== __filename;

function reloadModules() {
  const dropped = new Map();
  for (const file of Object.keys(require.cache)) {
    if (!isReloadable(file)) continue;
    dropped.set(file, require.cache[file]);
    delete require.cache[file];
  }
  try {
    live = loadLive();
  } catch (err) {
    for (const [file, mod] of dropped) require.cache[file] = mod;   // сломанная правка не должна останавливать доску
    throw err;
  }
}

let reloadTimer = null;
function scheduleReload(filename) {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    try {
      reloadModules();
      rebuild(`${filename} перечитан`);
    } catch (err) {
      console.error(`${filename} не перечитан (остаётся прежний):`, err.message);
    }
  }, DEBOUNCE_MS);
}

// Каталоги смотрятся без рекурсии, по расширению: `.cache/data.json` сервер пишет сам, и рекурсивное
// слежение зациклило бы пересборку на собственной записи.
function watchModules() {
  const dirs = [ROOT, path.join(ROOT, 'data'), path.join(ROOT, 'lib')];
  try {
    for (const dir of dirs) {
      fs.watch(dir, (eventType, filename) => {
        if (filename && /\.c?js$/.test(filename)) scheduleReload(filename);
      });
    }
    console.log(`Слежение включено: ${path.relative(PROJECT_ROOT, ROOT)}/ (сборщик, data/, lib/)`);
  } catch (err) {
    console.log(`Слежение за сборщиком недоступно (${err.message}) — правки модулей потребуют перезапуска.`);
  }
}

function watchFeatures() {
  if (!fs.existsSync(FEATURES_DIR)) {
    console.log(`Внимание: ${path.relative(PROJECT_ROOT, FEATURES_DIR)} не найден — слежение за карточками не запущено.`);
    return;
  }
  try {
    // recursive:true поддержан на Windows и macOS; на Linux fs.watch не рекурсивен —
    // на этой платформе живое обновление придёт с задержкой до следующего ручного
    // запуска, но сервер и ручной `node generate.js` продолжают работать как раньше.
    fs.watch(FEATURES_DIR, { recursive: true }, (eventType, filename) => {
      if (filename && !filename.endsWith('.md')) return;
      scheduleRebuild(filename || eventType);
    });
    console.log(`Слежение включено: ${path.relative(PROJECT_ROOT, FEATURES_DIR)}`);
  } catch (err) {
    console.log(`Слежение недоступно на этой платформе (${err.message}) — данные обновляются только при перезапуске сервера или ручном \`node .forma/dashboard/generate.js\`.`);
  }
}

function watchPicture() {
  // Следим за каталогом, а не за файлом: картины может ещё не быть (интервью не
  // начато), а fs.watch по несуществующему пути бросает — и слежение не встало бы
  // именно в тот момент, ради которого оно заводилось.
  if (!fs.existsSync(BRIEF_DIR)) return;
  try {
    fs.watch(BRIEF_DIR, (eventType, filename) => {
      const name = filename && path.basename(filename);
      // Три слоя, за которыми есть смысл следить: разобранное, дословное и связное.
      const WATCHED = ['picture.json', 'answers.jsonl', 'idea.md'];
      if (name && !WATCHED.includes(name)) return;
      scheduleRebuild(name || 'brief');
    });
    console.log(`Слежение включено: ${path.relative(PROJECT_ROOT, BRIEF_DIR)} (картина, ответы и идея)`);
  } catch (err) {
    console.log(`Слежение за картиной интервью недоступно (${err.message}).`);
  }
}

function watchGraphifyLog() {
  if (!fs.existsSync(GRAPHIFY_LOG)) return;
  try {
    // Файл, не каталог: watch(ROOT) ловил бы и собственную запись data.json сервером
    // в этот же каталог — цикл пересборок без внешней причины.
    fs.watch(GRAPHIFY_LOG, () => scheduleRebuild('graphify.log'));
    console.log(`Слежение включено: ${path.relative(PROJECT_ROOT, GRAPHIFY_LOG)}`);
  } catch (err) {
    console.log(`Слежение за graphify.log недоступно (${err.message}).`);
  }
}

// ---------- маршруты ----------

const queryOf = (req) => new URL(req.url, 'http://x').searchParams;

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': MIME['.json'] });
  res.end(JSON.stringify(obj));
}

// Ждёт, пока страница сессии поднимется, и отвечает её адресом. `o.extra` — что добавить к ответу,
// `o.watchPosition` — позиция, за сессией которой начать следить, `o.failMessage` — своя фраза вместо ошибки ожидания.
function replyGrillUrl(res, session, o = {}) {
  grillUrl(session, GRILL_WAIT_MS).then((url) => {
    if (o.watchPosition !== undefined) watchSessionEvents(session, o.watchPosition);
    sendJson(res, 200, { ok: true, url, session, ...o.extra });
  }).catch((err) => sendJson(res, 500, { ok: false, error: o.failMessage || err.message }));
}

function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify(latestData)}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

function handleData(req, res) {
  res.writeHead(200, { 'Content-Type': MIME['.json'] });
  res.end(JSON.stringify(latestData, null, 2));
}

// Сколько раскруток уже есть в текущем заходе позиции.
function countExpanded(position) {
  try {
    const { readSessions, currentSession } = live.sessions;
    const cur = currentSession(readSessions(PROJECT_ROOT)[String(position)]);
    return cur ? (readState(cur).questions || []).filter((x) => /^x-/.test(x.id)).length : 0;
  } catch {
    return 0;   // нет сессии или state.json не разобрался — раскруток не было
  }
}

// Куда лечь вопросу раскрутки. Идёт живой разговор по позиции — вопрос уходит в него:
// один канал, одна вкладка (`existing` — тот же узел уже спрошен и ещё не отвечен, дублировать нечего).
// Живого нет — заводится новый заход.
function attachExpandQuestion(hit, q) {
  const { readSessions, currentSession, serverOf } = live.sessions;
  const session = currentSession(readSessions(PROJECT_ROOT)[String(hit.position)]);
  const hasLive = session && fs.existsSync(path.join(session, 'state.json')) && serverOf(session).alive;
  if (!hasLive) return { session: ensureGrillSession(hit.position, [q], true) };

  const state = readState(session);
  const already = (state.questions || []).find((x) => x.node === hit.node.id && x.status === 'open');
  if (already) return { session, existing: already.id };
  const round = Math.max(0, ...(state.questions || []).map((x) => Number(x.round) || 0)) + 1;
  state.questions.push({
    id: q.id, round, deps: [], title: q.title, body: q.text, node: q.node,
    options: [], status: 'open', durable: false, updated: false,
  });
  state.note = 'Раскрутка узла дерева: «' + hit.node.label + '».';
  reopen(state);
  writeState(session, state);
  return { session };
}

// Раскрутка узла дерева картины. Дашборд открывает страницу интервью вкладкой; формы внутри
// дашборда нет намеренно: два места ввода под одни и те же вопросы — это и есть та усталость
// от разных окошек, ради которой всё сведено в один привычный формат.
function handleExpand(req, res) {
  const nodeId = queryOf(req).get('node');
  const hit = findNode((latestData.interview || {}).tree, nodeId, 1);
  if (!hit) return sendJson(res, 404, { ok: false, error: 'node not found: ' + nodeId });
  const { position } = hit;
  const q = expandQuestion(hit.node, countExpanded(position));
  let target;
  try {
    target = attachExpandQuestion(hit, q);
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: 'could not expand the node: ' + err.message });
  }
  if (target.existing) {
    return replyGrillUrl(res, target.session, {
      extra: { position, existing: target.existing }, failMessage: 'the interview page is not responding',
    });
  }
  replyGrillUrl(res, target.session, { extra: { position }, watchPosition: position });
}

// Кнопка позиции: отдаёт адрес страницы интервью — дашборд открывает её вкладкой.
function handleOpen(req, res) {
  const params = queryOf(req);
  const position = Number(params.get('position'));
  const resume = params.get('resume') === '1';
  const questions = resume ? resumeQuestions(position) : openingQuestions(position);
  if (!questions.length) return sendJson(res, 400, { ok: false, error: 'the questions for this position are not written yet' });
  let session;
  try {
    session = ensureGrillSession(position, questions, resume);
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: 'the session did not start: ' + err.message });
  }
  replyGrillUrl(res, session, { watchPosition: position });
}

// Тело ответа человека → `{ position, answers }` или `{ error }`.
function parseAnswerBody(body) {
  let position, answers;
  try {
    const parsed = JSON.parse(body);
    position = Number(parsed.position);
    answers = Array.isArray(parsed.answers) ? parsed.answers : null;
  } catch {
    return { error: 'bad JSON' };
  }
  if (!Number.isInteger(position) || !answers) return { error: 'position and answers are required' };
  return { position, answers };
}

// Пустые ответы отбрасываются здесь, а не на экране: человек мог ответить
// на один вопрос из трёх, и это нормально — но записывать пустоту как
// ответ нельзя, её потом не отличить от «сказал, но невнятно».
// Элемент, не похожий на объект (`null`, число, строка), — не ответ: пропускается, а не роняет процесс.
const cleanAnswers = (answers) => answers
  .filter((a) => a && typeof a === 'object')
  .map((a) => ({ id: String(a.id || ''), text: String(a.text || '').trim() }))
  .filter((a) => a.id && a.text);

function saveAnswers(res, body) {
  const parsed = parseAnswerBody(body);
  if (parsed.error) return sendJson(res, 400, { ok: false, error: parsed.error });
  const { position } = parsed;
  const clean = cleanAnswers(parsed.answers);
  if (!clean.length) return sendJson(res, 400, { ok: false, error: 'an empty answer is not recorded' });
  try {
    fs.mkdirSync(BRIEF_DIR, { recursive: true });
    const record = { at: new Date().toISOString(), position, answers: clean };
    fs.appendFileSync(ANSWERS_FILE, JSON.stringify(record) + '\n', 'utf8');
    sendJson(res, 200, { ok: true, position, saved: clean.length });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message });
  }
}

// Ответы человека принимаются дословно и **дописываются**, не переписывают
// прежние: сказанное однажды остаётся как сказано. Картину (`picture.json`)
// этот путь не трогает вовсе — картина синтез `Intent`, и писать её отсюда
// значило бы выдать сырой ответ за понятый.
function handleAnswer(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_ANSWER_BYTES) req.destroy();
  });
  req.on('end', () => saveAnswers(res, body));
}

// Остальное — файлы. Графы живут в .forma/living/graphs/ (динамическое — отдельно от кода дашборда), адрес /graphs/ прежний.
function handleStatic(req, res, urlPath) {
  const base = urlPath.startsWith('/graphs/') ? path.join(PROJECT_ROOT, '.forma/living') : ROOT;
  const filePath = path.join(base, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(base)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found: ' + urlPath); return; }
    // Доска живая, и её страница не кэшируется никогда. Без этого браузер вправе
    // показывать вчерашнюю копию сколько ему угодно: сервер уже пересобрал данные,
    // отдал свежий HTML, а человек смотрит на старое и отличить это от поломки не может.
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(data);
  });
}

// Языки интерфейса: по файлу на язык в locales/ (web/js/i18n.js).
function handleLocales(req, res) { sendJson(res, 200, { default: i18n.FALLBACK, locales: i18n.listLocales() }); }

// Таблица маршрутов: метод + путь → функция `(req, res)`. Нет строки — `handleStatic`.
// ANY — маршрут, который не смотрел на метод и до таблицы; так и оставлен, чтобы разбор запроса не менял поведения.
const ANY = '*';
const ROUTES = [
  { method: ANY, path: '/events', handle: handleEvents },
  { method: ANY, path: '/interview/expand', handle: handleExpand },
  { method: ANY, path: '/interview/open', handle: handleOpen },
  { method: 'POST', path: '/interview/answer', handle: handleAnswer },
  { method: ANY, path: '/data.json', handle: handleData },
  { method: ANY, path: '/locales.json', handle: handleLocales },
];

const findRoute = (method, urlPath) => ROUTES.find((r) => r.path === urlPath && (r.method === ANY || r.method === method));

// Битая %-последовательность (`/%E0%A4%A`) и нулевой байт (`/%00`, его не принимает fs) в пути — ошибка клиента:
// 400, а не исключение в обработчике.
function decodePath(rawUrl) {
  try {
    const decoded = decodeURIComponent(rawUrl.split('?')[0]);
    return decoded.includes('\0') ? null : decoded;
  } catch { return null; }
}

function handleRequest(req, res) {
  const urlPath = decodePath(req.url);
  if (urlPath === null) return sendJson(res, 400, { ok: false, error: 'bad address' });
  const route = findRoute(req.method, urlPath);
  if (route) route.handle(req, res);
  else handleStatic(req, res, urlPath);
}

// ---------- запуск ----------

// Выбор порта: сперва порт прошлого запуска (.forma/dashboard/.cache/server.json), при занятости (EADDRINUSE) —
// свободный эфемерный порт от ОС, реальный порт пишется в файл и печатается в консоль. Чтение запомненного
// порта — общий модуль сессий интервью, тот же, что у сервера страницы интервью.
// attempt=0 — «слушай на эфемерном, какой даст ОС» (node/libuv трактуют явный 0 именно так,
// не как «порт не указан»). Пока attempt не 0 и слушатель ещё не встал — EADDRINUSE переключает
// на эфемерный один раз и не более (второй провал того же рода — уже не «порт занят», настоящая
// ошибка сети, падаем как раньше).
const srv = http.createServer(handleRequest);
let attempt = live.sessions.rememberedPort(SERVER_FILE) || DEFAULT_PORT;

function onServerError(err) {
  if (!srv.listening && attempt !== 0 && err.code === 'EADDRINUSE') {
    console.log(`Порт ${attempt} занят — пробую свободный эфемерный порт от ОС...`);
    attempt = 0;
    srv.listen(0);
    return;
  }
  console.error('Ошибка сервера:', err.message);
  process.exit(1);
}

function onListening() {
  const { port } = srv.address();
  const url = `http://localhost:${port}/`;
  writeJsonAtomic(SERVER_FILE, { url, port, pid: process.pid, started: new Date().toISOString() });
  console.log(`Дашборд: ${url}`);
  console.log(`Собрано при старте: карточек ${latestData.totals.cardCount}, токенов по движкам ${JSON.stringify(latestData.totals.tokensByEngine)}`);
  watchFeatures();
  watchGraphifyLog();
  watchPicture();
  watchModules();
  resumeSessionWatchers();
}

srv.on('error', onServerError);
srv.on('listening', onListening);
srv.listen(attempt);
