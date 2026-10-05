#!/usr/bin/env node
// Разовая проверка: жив ли дашборд ЭТОГО проекта. Если нет — поднимает супервизор
// (watch.js, который дальше сам следит за serve.js и перезапускает его при падении)
// полностью в фоне, detached — переживает завершение этого процесса и завершение
// сессии, которая его вызвала.
//
// Порт дашборда динамический (serve.js: запомненный порт → при занятости эфемерный
// от ОС, `kit.md`-задача «динамический порт для дашборда»), поэтому живость проверяем
// не по захардкоженной константе, а по факту из .forma/dashboard/.cache/server.json — том же
// файле, который serve.js сам пишет при собственном listening ({url, port, pid, started}).
// Решающий факт — не только порт, но и pid: серверный файл может протухнуть (процесс
// с прошлого запуска уже не существует), а порт из него — указывать в никуда или,
// хуже, на чужой процесс, который случайно там что-то слушает. Живой pid + ответ
// HTTP на записанном порту — только тогда доверяем файлу; иначе — прежнее поведение,
// дефолтный порт 5050 (`kit.md`-задача «ensure-running.js не знает про динамический
// порт», п.2).
//
// Безопасно вызывать повторно (идемпотентно): если дашборд уже жив — ничего
// не делает и не плодит вторых серверов. Вызывается из хука SessionStart
// (хук старта сессии в каталоге адаптера) и может вызываться вручную:
//   node .forma/dashboard/ensure-running.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { DEFAULT_PORT } = require('./port.cjs');
const TIMEOUT_MS = 800;
const WATCH_PATH = path.join(__dirname, 'watch.js');
const CACHE_DIR = path.join(__dirname, '.cache');
const LOG_FILE = path.join(CACHE_DIR, 'watch.log');
const SERVER_FILE = path.join(CACHE_DIR, 'server.json');

// process.kill(pid, 0) не шлёт сигнал — стандартный способ узнать, существует ли процесс,
// без побочных эффектов. ESRCH — процесса нет (протухший файл); EPERM — процесс есть,
// но нет прав слать ему сигналы (тоже «жив», просто не наш пользователь/привилегии).
function pidAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (err) { return err.code === 'EPERM'; }
}

function readServerFile() {
  try {
    const info = JSON.parse(fs.readFileSync(SERVER_FILE, 'utf8'));
    const port = Number(info.port);
    const pid = Number(info.pid);
    if (!Number.isInteger(port) || port <= 0 || !Number.isInteger(pid) || pid <= 0) return null;
    return { port, pid };
  } catch {
    return null; // файла нет, или он битый/недописан (гонка с записью serve.js) — не решающий факт
  }
}

function httpAlive(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: 'localhost', port, path: '/data.json', timeout: TIMEOUT_MS }, (res) => {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// Возвращает { alive, port } — port это тот, на котором реально (или по старому
// умолчанию) проверялась живость, чтобы дальше можно было честно про него написать.
async function checkAlive() {
  const info = readServerFile();
  if (info && pidAlive(info.pid)) {
    return { alive: await httpAlive(info.port), port: info.port };
  }
  // Нет файла, он битый, или записанный pid уже не существует (протухший, от
  // прошлого запуска) — откат на прежнее поведение: дефолтный порт 5050.
  return { alive: await httpAlive(DEFAULT_PORT), port: DEFAULT_PORT };
}

async function main() {
  const { alive, port } = await checkAlive();
  if (alive) {
    console.log(`Дашборд уже работает: http://localhost:${port}/`);
    return;
  }

  console.log('Дашборд не отвечает — запускаю супервизор в фоне...');
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const out = fs.openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [WATCH_PATH], {
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  child.unref();
  console.log(`Супервизор поднят (pid ${child.pid}); лог — ${path.relative(process.cwd(), LOG_FILE)}`);
  // Порт нового запуска решает уже сам serve.js (тот же динамический выбор) — не всегда
  // 5050, если он занят. Точный адрес — .forma/dashboard/.cache/server.json через пару секунд.
  console.log(`Через пару секунд: обычно http://localhost:${DEFAULT_PORT}/ — точный адрес смотрите в .forma/dashboard/.cache/server.json, если порт был занят.`);
}

main();
