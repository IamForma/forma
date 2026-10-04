// Эндпоинты дашборда: сервер фикстуры на эфемерном порту, каждый маршрут отвечает как задумано.
// Страховка рефакторинга `dashboard/serve.js`: пропал маршрут или сменился код ответа — тест падает.
// FORMA_SERVE_JS=<файл> — прогнать на другой версии serve.js; FORMA_ROUTES_REPORT=<файл> — записать наблюдения.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture } = require('./helpers/fixture.cjs');
const { startServer, request, firstEvent } = require('./helpers/serve.cjs');

const JSON_TYPE = 'application/json; charset=utf-8';
const HTML_TYPE = 'text/html; charset=utf-8';
const NO_STORE = 'no-store, must-revalidate';

let fx;
let server;
const observed = [];
const brief = (...p) => path.join(fx.root, 'project', 'brief', ...p);

// Картина с деревом: без неё раскрутке узла нечего искать. Кладётся до старта — слежение за брифом
// включается только если каталог есть при запуске.
function writePicture() {
  fs.mkdirSync(brief(), { recursive: true });
  const tree = { id: 'root', label: 'Корень', tag: 'позиция 1', children: [{ id: 'n1', label: 'Первый узел' }] };
  fs.writeFileSync(brief('picture.json'), JSON.stringify({ topic: 'проба', round: 1, positions: [], tree }));
}

test.before(async () => {
  fx = makeFixture();
  writePicture();
  fs.mkdirSync(path.join(fx.root, '.forma', 'living', 'graphs'), { recursive: true });
  fs.writeFileSync(path.join(fx.root, '.forma', 'living', 'graphs', 'probe.json'), '{"probe":true}');
  server = await startServer(fx);
});

test.after(async () => {
  if (server) await server.stop();
  if (fx) fx.cleanup();
  const report = process.env.FORMA_ROUTES_REPORT;
  if (report) fs.writeFileSync(report, JSON.stringify(observed, null, 2) + '\n');
});

/** Запрос + запись наблюдения; тело в отчёт идёт только там, где оно детерминировано. */
async function hit(method, urlPath, { body, headers, keepBody = false } = {}) {
  const r = await request(server.port, method, urlPath, { body, headers });
  observed.push({
    method, path: urlPath, status: r.status, type: r.headers['content-type'] || null,
    cache: r.headers['cache-control'] || null, ...(keepBody ? { body: r.body } : {}),
  });
  return r;
}

const json = (r) => JSON.parse(r.body);

test('GET / и /index.html — страница дашборда, без кэша', async () => {
  for (const p of ['/', '/index.html']) {
    const r = await hit('GET', p);
    assert.equal(r.status, 200, p);
    assert.equal(r.headers['content-type'], HTML_TYPE);
    assert.equal(r.headers['cache-control'], NO_STORE);
    assert.match(r.body, /<html/i);
  }
});

test('GET /data.json — срез данных: три карточки фикстуры', async () => {
  const r = await hit('GET', '/data.json');
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], JSON_TYPE);
  const data = json(r);
  assert.equal(data.totals.cardCount, 3);
  assert.equal(data.interview.tree.id, 'root', 'картина, положенная до старта, читается');
});

test('GET /events — поток: первое событие несёт тот же срез', async () => {
  const r = await firstEvent(server.port);
  observed.push({ method: 'GET', path: '/events', status: r.status, type: r.headers['content-type'], cache: r.headers['cache-control'] });
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'text/event-stream; charset=utf-8');
  assert.equal(r.headers['cache-control'], 'no-cache');
  assert.ok(r.body.startsWith('data: {'), r.body.slice(0, 40));
  assert.equal(JSON.parse(r.body.slice('data: '.length)).totals.cardCount, 3);
});

test('статика: нет файла — 404, выход из каталога — 403, графы берутся из living/graphs', async () => {
  const missing = await hit('GET', '/nope.txt', { keepBody: true });
  assert.equal(missing.status, 404);
  assert.equal(missing.body, 'not found: /nope.txt');

  const escape = await hit('GET', '/../package.json', { keepBody: true });
  assert.equal(escape.status, 403);
  assert.equal(escape.body, 'forbidden');

  const graph = await hit('GET', '/graphs/probe.json', { keepBody: true });
  assert.equal(graph.status, 200);
  assert.equal(graph.headers['content-type'], JSON_TYPE);
  assert.equal(graph.body, '{"probe":true}');

  const noGraph = await hit('GET', '/graphs/absent.json');
  assert.equal(noGraph.status, 404);
});

test('POST /interview/answer — ответы дописываются дословно, плохой ввод — 400', async () => {
  const post = (body) => hit('POST', '/interview/answer', { body, keepBody: true, headers: { 'content-type': 'application/json' } });

  const bad = await post('{нет');
  assert.equal(bad.status, 400);
  assert.deepEqual(json(bad), { ok: false, error: 'bad JSON' });

  const noFields = await post('{}');
  assert.equal(noFields.status, 400);
  assert.deepEqual(json(noFields), { ok: false, error: 'position and answers are required' });

  const empty = await post(JSON.stringify({ position: 1, answers: [{ id: 'q1', text: '   ' }, { text: 'без id' }] }));
  assert.equal(empty.status, 400);
  assert.deepEqual(json(empty), { ok: false, error: 'an empty answer is not recorded' });
  assert.ok(!fs.existsSync(brief('answers.jsonl')), 'пустое в бриф не попало');

  const ok = await post(JSON.stringify({ position: 1, answers: [{ id: 'q1', text: ' сказано ' }, { id: 'q2', text: '' }] }));
  assert.equal(ok.status, 200);
  assert.deepEqual(json(ok), { ok: true, position: 1, saved: 1 });
  const lines = fs.readFileSync(brief('answers.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].answers, [{ id: 'q1', text: 'сказано' }]);
  assert.equal(lines[0].position, 1);
});

test('GET /interview/answer — маршрут только для POST: остальное уходит в статику и даёт 404', async () => {
  const r = await hit('GET', '/interview/answer', { keepBody: true });
  assert.equal(r.status, 404);
  assert.equal(r.body, 'not found: /interview/answer');
});

test('/interview/open — позиция без вопросов 400; с вопросами поднимает страницу, второй вызов её же', async () => {
  const none = await hit('GET', '/interview/open?position=5', { keepBody: true });
  assert.equal(none.status, 400);
  assert.deepEqual(json(none), { ok: false, error: 'the questions for this position are not written yet' });
  const noParam = await hit('GET', '/interview/open', { keepBody: true });
  assert.equal(noParam.status, 400);

  const first = await hit('GET', '/interview/open?position=1');
  assert.equal(first.status, 200, first.body);
  const a = json(first);
  assert.equal(a.ok, true);
  assert.match(a.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  const { OPENING_ROUND } = require(path.join(fx.root, '.forma', 'dashboard', 'data', 'interview-spec.cjs'));
  const state = json(await request(Number(new URL(a.url).port), 'GET', '/state'));
  assert.equal(state.questions.length, OPENING_ROUND[1].length, 'страница засеяна вопросами первого захода');

  const sessions = JSON.parse(fs.readFileSync(brief('sessions.json'), 'utf8'));
  assert.deepEqual(sessions['1'], [a.session], 'заход записан в sessions.json');

  const again = json(await hit('GET', '/interview/open?position=1'));
  assert.equal(again.session, a.session, 'живой заход не заводится второй раз');
  assert.equal(again.url, a.url);

  const resumed = await hit('GET', '/interview/open?position=1&resume=1');
  assert.equal(resumed.status, 200);
  const r = json(resumed);
  assert.notEqual(r.session, a.session, 'возобновление — новый заход');
  const list = JSON.parse(fs.readFileSync(brief('sessions.json'), 'utf8'))['1'];
  assert.deepEqual(list, [a.session, r.session]);
});

test('/interview/expand — нет узла 404; узел раскручивается в живой заход, повтор не дублирует вопрос', async () => {
  const miss = await hit('GET', '/interview/expand?node=absent', { keepBody: true });
  assert.equal(miss.status, 404);
  assert.deepEqual(json(miss), { ok: false, error: 'node not found: absent' });
  const noNode = await hit('GET', '/interview/expand', { keepBody: true });
  assert.equal(noNode.status, 404);
  assert.deepEqual(json(noNode), { ok: false, error: 'node not found: null' });

  const first = await hit('GET', '/interview/expand?node=n1');
  assert.equal(first.status, 200, first.body);
  const a = json(first);
  assert.equal(a.ok, true);
  assert.equal(a.position, 1);
  assert.equal(a.existing, undefined);
  const state = json(await request(Number(new URL(a.url).port), 'GET', '/state'));
  const asked = state.questions.filter((q) => q.node === 'n1');
  assert.equal(asked.length, 1);
  assert.match(asked[0].body, /Первый узел/);

  const again = json(await hit('GET', '/interview/expand?node=n1'));
  assert.equal(again.ok, true);
  assert.equal(again.session, a.session);
  assert.equal(again.existing, asked[0].id, 'открытый вопрос по узлу не дублируется');
});
