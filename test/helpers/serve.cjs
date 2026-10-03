// Дашборд-сервер в фикстуре: отдельный процесс на эфемерном порту, изолированный HOME, гасится явно.
// Живой дашборд проекта не затрагивается: порт выбирается заранее и кладётся в server.json фикстуры,
// так что DEFAULT_PORT (5050) сервер фикстуры не пробует вовсе.
const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const READY_RE = /Дашборд: http:\/\/localhost:(\d+)\//;
const START_TIMEOUT_MS = 60000;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

const isAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

async function waitDead(pid, ms = 5000) {
  const until = Date.now() + ms;
  while (isAlive(pid) && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
}

/** pid серверов страниц интервью, которые поднял дашборд фикстуры (они отделены от него и сами не гаснут). */
function grillPids(home) {
  const root = path.join(home, '.grill-with-ui', 'sessions');
  const pids = [];
  const visit = (dir) => {
    for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visit(p);
      else if (e.name === 'server.json') {
        try { pids.push(Number(JSON.parse(fs.readFileSync(p, 'utf8')).pid)); } catch { /* не записан — сервера нет */ }
      }
    }
  };
  visit(root);
  return pids.filter(Boolean);
}

/**
 * Поднимает `dashboard/serve.js` фикстуры. `opts.serveJs` (или переменная FORMA_SERVE_JS) — другой файл на его место:
 * так тест гоняется на старой версии сервера.
 */
async function startServer(fx, opts = {}) {
  const override = opts.serveJs || process.env.FORMA_SERVE_JS;
  const serveFile = path.join(fx.root, '.forma', 'dashboard', 'serve.js');
  if (override) fs.copyFileSync(override, serveFile);
  const cache = path.join(fx.root, '.forma', 'dashboard', '.cache');
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(path.join(cache, 'server.json'), JSON.stringify({ port: await freePort() }));

  const env = { ...fx.env, GRILL_HOME: path.join(fx.home, '.grill-with-ui') };
  const child = spawn(process.execPath, [opts.entry || serveFile], { cwd: fx.root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let log = '';
  // Под супервизором (watch.js) сервер — внук: его pid знает только server.json. Супервизор гасится первым,
  // иначе он поднимет сервер заново.
  const servePid = () => {
    try { return Number(JSON.parse(fs.readFileSync(path.join(cache, 'server.json'), 'utf8')).pid) || 0; } catch { return 0; }
  };
  const stop = async () => {
    const pids = [child.pid, servePid(), ...grillPids(fx.home)].filter(Boolean);
    for (const pid of pids) { try { process.kill(pid); } catch { /* уже завершён */ } }
    for (const pid of pids) await waitDead(pid);
  };
  // Не поднялся — не оставляем за собой процессы: супервизор перезапускал бы упавший сервер бесконечно.
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('сервер не поднялся за отведённое время:\n' + log)), START_TIMEOUT_MS);
    const onData = (chunk) => {
      log += chunk;
      const m = READY_RE.exec(log);
      if (m) { clearTimeout(timer); resolve(Number(m[1])); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (c) => { log += c; });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`сервер завершился (код ${code}):\n${log}`)); });
  }).catch(async (err) => { await stop(); throw err; });

  return { port, child, servePid, log: () => log, stop };
}

/** Один запрос; путь уходит как есть (клиент `http` не нормализует `/../`). */
function request(port, method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('таймаут запроса ' + method + ' ' + urlPath)));
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/** Первый кусок потока /events, потом соединение закрывается. */
function firstEvent(port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/events' }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk.toString('utf8');
        if (!body.includes('\n\n')) return;   // событие приходит кусками; конец — пустая строка
        req.destroy();
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', (err) => { if (err.code !== 'ECONNRESET') reject(err); });
  });
}

module.exports = { startServer, request, firstEvent, freePort, isAlive, waitDead };
