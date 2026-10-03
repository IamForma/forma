// Правка модуля дашборда доходит до работающего сервера сама, без перезапуска; супервизор поднимает упавший сервер.
// Всё — в фикстуре, на эфемерном порту. FORMA_SERVE_JS=<файл> — прогнать на другой версии serve.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture } = require('./helpers/fixture.cjs');
const { startServer, request, waitDead } = require('./helpers/serve.cjs');

const POLL_MS = 100;
const REACT_MS = 15000;   // сколько ждать реакции сервера на правку (слежение + задержка 300 мс + пересборка)
let fx;
let server;

const dash = (...p) => path.join(fx.root, '.forma', 'dashboard', ...p);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const data = async () => JSON.parse((await request(server.port, 'GET', '/data.json')).body);
const firstPosition = async () => (await data()).interview.positions[0];

async function until(check, what) {
  const stop = Date.now() + REACT_MS;
  let last;
  while (Date.now() < stop) {
    last = await check();
    if (last) return last;
    await sleep(POLL_MS);
  }
  throw new Error(`не дождались: ${what}\n${server.log().slice(-1500)}`);
}

const append = (file, code) => fs.appendFileSync(file, '\n' + code + '\n');

test.before(async () => {
  fx = makeFixture();
  server = await startServer(fx);
});

test.after(async () => {
  if (server) await server.stop();
  if (fx) fx.cleanup();
});

test('правка модуля data/ подхватывается: сервер отдаёт новое без перезапуска', async () => {
  assert.equal((await firstPosition()).name, 'Облик');
  const pid = server.servePid();
  append(dash('data', 'interview-spec.cjs'), "module.exports.POSITIONS[0].name = 'Облик-правка';");
  await until(async () => (await firstPosition()).name === 'Облик-правка', 'новое имя позиции в /data.json');
  assert.equal(server.servePid(), pid, 'процесс тот же — перезапуска не было');
});

test('сломанная правка не роняет сервер: остаётся прежнее, причина в логе; исправление снова подхватывается', async () => {
  const file = dash('data', 'interview-spec.cjs');
  const good = fs.readFileSync(file, 'utf8');
  try {
    fs.writeFileSync(file, good + "\nthrow new Error('проба поломки');\n");
    await until(() => server.log().includes('не перечитан (остаётся прежний)'), 'сообщение о непрочитанной правке');
    const still = await request(server.port, 'GET', '/data.json');
    assert.equal(still.status, 200);
    assert.equal((await firstPosition()).name, 'Облик-правка', 'остались прежние данные');
  } finally {
    fs.writeFileSync(file, good + "\nmodule.exports.POSITIONS[0].name = 'Облик-исправлено';\n");   // файл не остаётся сломанным
  }
  await until(async () => (await firstPosition()).name === 'Облик-исправлено', 'исправленная правка');
});

test('правка модуля сессий (lib/interview-sessions.cjs) подхватывается тем же путём', async () => {
  assert.equal((await data()).interview.positions[1].session, null, 'до правки у позиции 2 сессии нет');
  append(dash('lib', 'interview-sessions.cjs'),
    "const _pos = module.exports.positionSessions;\n"
    + "module.exports.positionSessions = (r) => [..._pos(r), { position: 2, dirs: ['/probe/none'] }];");
  const seen = await until(async () => (await data()).interview.positions[1].session, 'сессия позиции 2 в /data.json');
  assert.deepEqual(seen, { url: null, alive: false });
});

test('правка сборщика generate.js подхватывается', async () => {
  const before = (await data()).totals.cardCount;
  append(dash('generate.js'), "const _build = module.exports.buildData;\n"
    + "module.exports.buildData = (root) => { const d = _build(root); d.totals.cardCount += 100; return d; };");
  await until(async () => (await data()).totals.cardCount === before + 100, 'сборщик с правкой');
});

test('watch.js: упавший сервер поднимается заново на том же порту и отвечает', async () => {
  await server.stop();
  const supervised = await startServer(fx, { entry: dash('watch.js') });
  try {
    const pid = supervised.servePid();
    assert.ok(pid, 'сервер под супервизором записал свой pid');
    process.kill(pid);
    await waitDead(pid);
    const next = await until(() => { const p = supervised.servePid(); return p && p !== pid ? p : 0; }, 'новый pid сервера в server.json');
    assert.notEqual(next, pid);
    const r = await until(async () => {
      try { const x = await request(supervised.port, 'GET', '/data.json'); return x.status === 200 ? x : null; } catch { return null; }
    }, 'ответ перезапущенного сервера');
    assert.equal(JSON.parse(r.body).interview.positions.length, 5);
  } finally {
    await supervised.stop();
  }
});
