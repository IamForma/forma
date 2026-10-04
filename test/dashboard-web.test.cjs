// Каркас дашборда: index.html — только разметка, стили и скрипты лежат в dashboard/web/ и отдаются статикой.
// Страховка рефакторинга: вернули встроенный <style>/<script>, разрослась страница, потерялся файл или
// сервер отдал стиль не тем типом — тест падает. Установка (forma init) берётся из фикстуры: она ставится им же.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { makeFixture } = require('./helpers/fixture.cjs');
const { startServer, request } = require('./helpers/serve.cjs');

const MAX_INDEX_LINES = 200;
const TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

let fx;
let server;
let html;
let assets;
const dash = (...p) => path.join(fx.root, '.forma', 'dashboard', ...p);

test.before(async () => {
  fx = makeFixture();
  html = fs.readFileSync(dash('index.html'), 'utf8');
  // Только свои файлы: внешние (CDN, шрифты) начинаются со схемы.
  assets = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^":]+)"/g)].map((m) => m[1]);
  server = await startServer(fx);
});

test.after(async () => {
  if (server) await server.stop();
  if (fx) fx.cleanup();
});

test('index.html — только каркас: до 200 строк, без встроенных стилей и скриптов', () => {
  assert.ok(html.split('\n').length <= MAX_INDEX_LINES, `строк: ${html.split('\n').length}`);
  assert.ok(!/<style[\s>]/i.test(html), 'встроенный <style>');
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    assert.match(m[1], /\bsrc=/, 'встроенный <script> без src: ' + m[2].trim().slice(0, 60));
    assert.equal(m[2].trim(), '', 'у <script src> есть тело');
  }
});

test('установка кладёт все файлы, на которые ссылается index.html, и ни одного лишнего в web/', () => {
  assert.ok(assets.some((a) => a.endsWith('.css')) && assets.some((a) => a.endsWith('.js')), assets.join(', '));
  for (const a of assets) assert.ok(fs.existsSync(dash(a)), 'нет файла ' + a);
  const onDisk = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : onDisk.push(path.relative(dash(), path.join(d, e.name)).replace(/\\/g, '/'))));
  walk(dash('web'));
  assert.deepEqual(onDisk.sort(), [...assets].sort(), 'файлы web/ и ссылки index.html расходятся');
});

test('скрипты разбираются как классические (без модулей) и идут в порядке: i18n первым, common вторым, app последним', () => {
  const js = assets.filter((a) => a.endsWith('.js'));
  assert.deepEqual(js.slice(0, 2).map((a) => path.basename(a)), ['i18n.js', 'common.js']);
  assert.equal(path.basename(js[js.length - 1]), 'app.js');
  for (const a of js) assert.doesNotThrow(() => new vm.Script(fs.readFileSync(dash(a), 'utf8'), { filename: a }), a);
});

test('сервер отдаёт стили и скрипты статикой с верным типом и без кэша', async () => {
  for (const a of assets) {
    const r = await request(server.port, 'GET', '/' + a);
    assert.equal(r.status, 200, a);
    assert.equal(r.headers['content-type'], TYPES[path.extname(a)], a);
    assert.equal(r.headers['cache-control'], 'no-store, must-revalidate', a);
    assert.equal(r.body, fs.readFileSync(dash(a), 'utf8'), a);
  }
});

test('сервер отдаёт список языков и словари en и ru', async () => {
  const r = await request(server.port, 'GET', '/locales.json');
  assert.equal(r.status, 200);
  const j = JSON.parse(r.body);
  assert.equal(j.default, 'en');
  assert.deepEqual(j.locales.map((l) => l.code), ['en', 'ru']);
  for (const code of ['en', 'ru']) assert.equal((await request(server.port, 'GET', `/locales/${code}.json`)).status, 200);
});
