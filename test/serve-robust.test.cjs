// Дашборд-сервер переживает битый ввод: плохая %-последовательность в пути и не-объекты в `answers`
// отвечают 4xx, процесс остаётся живым и следующий запрос проходит. Поведение на нормальном вводе —
// в serve-routes.test.cjs; здесь только то, что раньше роняло процесс необработанным исключением.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture } = require('./helpers/fixture.cjs');
const { startServer, request, isAlive } = require('./helpers/serve.cjs');

let fx;
let server;

// Сервер на каждый тест свой: упавший процесс не должен валить соседние тесты по цепочке.
test.before(() => { fx = makeFixture(); });
test.beforeEach(async () => { server = await startServer(fx); });
test.afterEach(async () => { if (server) await server.stop(); });
test.after(() => { if (fx) fx.cleanup(); });

const post = (body) => request(server.port, 'POST', '/interview/answer', { body, headers: { 'content-type': 'application/json' } });
const answersFile = () => path.join(fx.root, 'project', 'brief', 'answers.jsonl');

/** Процесс жив и отвечает: тот же pid, страница отдаётся. */
async function assertAlive(step) {
  assert.ok(isAlive(server.child.pid), `процесс сервера упал после: ${step}\n${server.log()}`);
  const r = await request(server.port, 'GET', '/');
  assert.equal(r.status, 200, `GET / после: ${step}`);
}

test('битая %-последовательность и нулевой байт в пути — 400, процесс жив', async () => {
  for (const bad of ['/%E0%A4%A', '/%', '/%zz', '/graphs/%E0%A4%A', '/%00', '/a%00.html']) {
    const r = await request(server.port, 'GET', bad);
    assert.equal(r.status, 400, bad);
    await assertAlive(bad);
  }
});

test('null и не-объекты в answers — пропускаются или 400, процесс жив', async () => {
  const pos = 1;
  const allBad = await post(JSON.stringify({ position: pos, answers: [null, 5, 'строка', [], true] }));
  assert.equal(allBad.status, 400, allBad.body);
  assert.ok(!fs.existsSync(answersFile()), 'мусор в бриф не попал');
  await assertAlive('answers из одних не-объектов');

  const mixed = await post(JSON.stringify({ position: pos, answers: [null, { id: 'q1', text: ' сказано ' }, 7] }));
  assert.equal(mixed.status, 200, mixed.body);
  assert.deepEqual(JSON.parse(mixed.body), { ok: true, position: pos, saved: 1 });
  const lines = fs.readFileSync(answersFile(), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(lines[0].answers, [{ id: 'q1', text: 'сказано' }]);
  await assertAlive('answers вперемешку');
});

test('null и не-объект вместо всего тела — 400, процесс жив', async () => {
  for (const body of ['null', '5', '"s"', '[]']) {
    const r = await post(body);
    assert.equal(r.status, 400, `${body}: ${r.body}`);
  }
  await assertAlive('тело не объект');
});
