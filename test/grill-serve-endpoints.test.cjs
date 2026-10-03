// Страница интервью (`skills/forma-grill-with-ui/server.mjs serve`): все эндпоинты и файлы сессии.
// Фиксирует поведение обработчика запросов, чтобы его можно было разбирать на функции без последствий.
// Сервер — отдельный процесс на порту из server.json фикстуры, изолированный HOME, гасится явно.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { makeFixture } = require('./helpers/fixture.cjs');
const { freePort, waitDead, request } = require('./helpers/serve.cjs');

const LOCATIONS = [
  ['.forma', 'skills', 'forma-grill-with-ui', 'server.mjs'],
  ['.claude', 'skills', 'forma-grill-with-ui', 'server.mjs'],
];
let fx;
test.before(() => { fx = makeFixture(); });
test.after(() => { if (fx) fx.cleanup(); });

/** Поднимает serve на сессии; возвращает порт, накопленный stdout и остановку. */
async function startSession(loc, name) {
  const dir = path.join(fx.base, name);
  fs.mkdirSync(dir, { recursive: true });
  const port = await freePort();
  fs.writeFileSync(path.join(dir, 'server.json'), JSON.stringify({ port }));
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ topic: 'проба', questions: [] }));
  const child = spawn(process.execPath, [path.join(fx.root, ...loc), 'serve', '--session', dir], { cwd: fx.root, env: fx.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = { out: '' };
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('страница не поднялась:\n' + log.out)), 15000);
    child.stdout.on('data', (c) => { log.out += c; if (log.out.includes('\n')) { clearTimeout(timer); resolve(); } });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`завершился (${code}):\n${log.out}`)); });
  });
  const stop = async () => { child.kill(); await waitDead(child.pid); };
  return { dir, port, log, stop };
}

for (const loc of LOCATIONS) {
  const label = loc.slice(0, -2).join('/');

  test(`${label}: serve — страница, состояние, события, визуал`, async () => {
    const s = await startSession(loc, 'ep-read-' + loc.join('_'));
    try {
      const ready = JSON.parse(s.log.out.split('\n')[0]);
      assert.equal(ready.type, 'ready');
      assert.equal(new URL(ready.url).port, String(s.port));
      assert.equal(ready.session, s.dir);
      const server = JSON.parse(fs.readFileSync(path.join(s.dir, 'server.json'), 'utf8'));
      assert.equal(server.port, s.port);
      assert.ok(Number.isInteger(server.pid), 'pid записан в server.json');

      const page = await request(s.port, 'GET', '/');
      assert.equal(page.status, 200);
      assert.match(page.headers['content-type'], /text\/html/);
      assert.equal(page.headers['cache-control'], 'no-store');
      assert.equal(page.body, fs.readFileSync(path.join(fx.root, ...loc.slice(0, -1), 'page.html'), 'utf8'));

      const state = await request(s.port, 'GET', '/state');
      assert.equal(state.status, 200);
      assert.equal(JSON.parse(state.body).topic, 'проба');
      // Агент переписывает state.json целиком: на полуслове отдаётся последний разбираемый.
      fs.writeFileSync(path.join(s.dir, 'state.json'), '{"topic": "обры');
      const kept = await request(s.port, 'GET', '/state');
      assert.equal(kept.status, 200);
      assert.equal(JSON.parse(kept.body).topic, 'проба');

      const events = await request(s.port, 'GET', '/events');
      assert.equal(events.status, 200);
      assert.equal(events.headers['content-type'], 'application/x-ndjson');
      assert.equal(events.body, '');

      const noVisual = await request(s.port, 'GET', '/visual');
      assert.equal(noVisual.status, 404);
      assert.deepEqual(JSON.parse(noVisual.body), { error: 'no visual' });
      fs.writeFileSync(path.join(s.dir, 'visual.html'), '<p>визуал</p>');
      const visual = await request(s.port, 'GET', '/visual');
      assert.equal(visual.status, 200);
      assert.match(visual.headers['content-type'], /text\/html/);
      assert.equal(visual.body, '<p>визуал</p>');

      const missing = await request(s.port, 'GET', '/nope');
      assert.equal(missing.status, 404);
      assert.deepEqual(JSON.parse(missing.body), { error: 'not found' });
      const wrongMethod = await request(s.port, 'POST', '/state', { body: '{}' });
      assert.equal(wrongMethod.status, 404);
    } finally { await s.stop(); }
  });

  test(`${label}: serve — нет state.json даёт 404`, async () => {
    const s = await startSession(loc, 'ep-nostate-' + loc.join('_'));
    try {
      fs.unlinkSync(path.join(s.dir, 'state.json'));
      const r = await request(s.port, 'GET', '/state');
      assert.equal(r.status, 404);
      assert.deepEqual(JSON.parse(r.body), { error: 'no state' });
    } finally { await s.stop(); }
  });

  test(`${label}: serve — /send пишет событие и будит агента строкой в stdout`, async () => {
    const s = await startSession(loc, 'ep-send-' + loc.join('_'));
    try {
      const bad = await request(s.port, 'POST', '/send', { body: 'не json' });
      assert.equal(bad.status, 400);
      assert.deepEqual(JSON.parse(bad.body), { error: 'body must be JSON' });
      const empty = await request(s.port, 'POST', '/send', { body: JSON.stringify({ actions: [] }) });
      assert.equal(empty.status, 400);
      assert.deepEqual(JSON.parse(empty.body), { error: 'actions must be a non-empty array' });
      const noActions = await request(s.port, 'POST', '/send', { body: 'null' });
      assert.equal(noActions.status, 400);

      const actions = [{ type: 'answer', q: 'q1', text: 'да' }];
      const one = await request(s.port, 'POST', '/send', { body: JSON.stringify({ actions }) });
      assert.equal(one.status, 200);
      assert.deepEqual(JSON.parse(one.body), { ok: true, seq: 1 });
      const two = await request(s.port, 'POST', '/send', { body: JSON.stringify({ actions }) });
      assert.deepEqual(JSON.parse(two.body), { ok: true, seq: 2 });

      const lines = fs.readFileSync(path.join(s.dir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      assert.equal(lines.length, 2);
      assert.deepEqual(lines.map((e) => e.seq), [1, 2]);
      assert.equal(lines[0].type, 'send');
      assert.equal(lines[0].session, s.dir);
      assert.deepEqual(lines[0].actions, actions);
      assert.ok(!Number.isNaN(Date.parse(lines[0].at)));

      const stdout = s.log.out.trim().split('\n').slice(1).map((l) => JSON.parse(l));
      assert.deepEqual(stdout.map((e) => e.seq), [1, 2], 'то же событие печатается в stdout');
      const events = await request(s.port, 'GET', '/events');
      assert.equal(events.body.trim().split('\n').length, 2);
    } finally { await s.stop(); }
  });

  test(`${label}: serve — /upload сохраняет файл, чистит имя, не затирает прежний`, async () => {
    const t = await startSession(loc, 'ep-upload-' + loc.join('_'));
    // Счёт seq продолжается от последнего события в events.jsonl.
    fs.writeFileSync(path.join(t.dir, 'events.jsonl'), '');
    try {
      const noBody = await request(t.port, 'POST', '/upload?name=a.png', { body: '' });
      assert.equal(noBody.status, 400);
      assert.deepEqual(JSON.parse(noBody.body), { error: 'empty file' });

      const a = await request(t.port, 'POST', '/upload?name=' + encodeURIComponent('../../evil<>.png') + '&q=q2&note=' + encodeURIComponent('заметка'), { body: 'данные' });
      assert.equal(a.status, 200);
      const ja = JSON.parse(a.body);
      assert.equal(ja.ok, true);
      assert.equal(ja.seq, 1);
      assert.equal(ja.file, 'evil.png');
      assert.equal(fs.readFileSync(path.join(t.dir, 'uploads', 'evil.png'), 'utf8'), 'данные');

      const b = await request(t.port, 'POST', '/upload?name=' + encodeURIComponent('evil.png'), { body: 'второй' });
      assert.equal(JSON.parse(b.body).file, 'evil-2.png');
      const c = await request(t.port, 'POST', '/upload?name=' + encodeURIComponent('evil.png'), { body: 'третий' });
      assert.equal(JSON.parse(c.body).file, 'evil-3.png');
      assert.equal(fs.readFileSync(path.join(t.dir, 'uploads', 'evil.png'), 'utf8'), 'данные', 'первый не затёрт');

      const noName = await request(t.port, 'POST', '/upload', { body: 'x' });
      assert.equal(JSON.parse(noName.body).file, 'file');
      const dots = await request(t.port, 'POST', '/upload?name=..', { body: 'x' });
      assert.equal(JSON.parse(dots.body).file, 'file-2');

      const lines = fs.readFileSync(path.join(t.dir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      assert.deepEqual(lines[0].actions, [{ type: 'upload', file: 'evil.png', bytes: Buffer.byteLength('данные'), q: 'q2', note: 'заметка' }]);
      assert.deepEqual(lines[1].actions, [{ type: 'upload', file: 'evil-2.png', bytes: Buffer.byteLength('второй') }]);
      const stdout = t.log.out.trim().split('\n').slice(1);
      assert.equal(stdout.length, lines.length, 'каждая загрузка будит агента');
    } finally { await t.stop(); }
  });

  test(`${label}: serve — слишком большой файл отклоняется`, async () => {
    const s = await startSession(loc, 'ep-big-' + loc.join('_'));
    try {
      const big = Buffer.alloc(10 * 1024 * 1024 + 1024, 1);
      let status;
      try { status = (await request(s.port, 'POST', '/upload?name=big.bin', { body: big })).status; } catch { status = 'reset'; }
      assert.ok(status === 413 || status === 'reset', 'ответ 413 либо обрыв соединения: ' + status);
      assert.ok(!fs.existsSync(path.join(s.dir, 'uploads', 'big.bin')));
    } finally { await s.stop(); }
  });

  test(`${label}: serve — --port выигрывает у server.json; занятый явный порт — ошибка, занятый прошлый — эфемерный`, async () => {
    const dir = path.join(fx.base, 'ep-port-' + loc.join('_'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'state.json'), '{}');
    const explicit = await freePort();
    const stale = await freePort();
    fs.writeFileSync(path.join(dir, 'server.json'), JSON.stringify({ port: stale }));
    const server = path.join(fx.root, ...loc);
    const start = (extra) => {
      const child = spawn(process.execPath, [server, 'serve', '--session', dir, ...extra], { cwd: fx.root, env: fx.env, stdio: ['ignore', 'pipe', 'pipe'] });
      const acc = { out: '', err: '' };
      child.stdout.on('data', (c) => { acc.out += c; });
      child.stderr.on('data', (c) => { acc.err += c; });
      const wait = (pred) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('таймаут:\n' + acc.out + acc.err)), 15000);
        const tick = setInterval(() => { if (pred(acc)) { clearTimeout(timer); clearInterval(tick); resolve(acc); } }, 50);
        child.on('exit', () => { if (pred(acc)) return; clearTimeout(timer); clearInterval(tick); resolve(acc); });
      });
      return { child, acc, wait };
    };
    const first = start(['--port', String(explicit)]);
    try {
      await first.wait((a) => a.out.includes('\n'));
      assert.equal(new URL(JSON.parse(first.acc.out.split('\n')[0]).url).port, String(explicit));
      // Тот же порт ещё раз, явно: занят — сервер падает с кодом 1.
      const clash = start(['--port', String(explicit)]);
      await new Promise((resolve) => clash.child.on('exit', (code) => { clash.code = code; resolve(); }));
      assert.equal(clash.code, 1);
      assert.match(clash.acc.err, /server error: .*EADDRINUSE|server error/);
    } finally { first.child.kill(); await waitDead(first.child.pid); }
    // Прошлый порт занят другим процессом: уходит на эфемерный, а не падает.
    const blocker = require('node:net').createServer();
    await new Promise((r) => blocker.listen(stale, '127.0.0.1', r));
    const fallback = start([]);
    try {
      await fallback.wait((a) => a.out.includes('\n'));
      const port = Number(new URL(JSON.parse(fallback.acc.out.split('\n')[0]).url).port);
      assert.notEqual(port, stale);
      assert.ok(port > 0);
    } finally { fallback.child.kill(); await waitDead(fallback.child.pid); blocker.close(); }
  });
}
