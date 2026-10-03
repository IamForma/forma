'use strict';

/**
 * Сессии интервью к брифу: карта «позиция → заходы», живость сервера страницы, порт прошлого запуска.
 * Одна копия на троих: `serve.js` (поднимает и опрашивает сессии), `data/interview-files.cjs` (показывает их на вкладке)
 * и `server.mjs` скилла `forma-grill-with-ui` (порт и живость своего сервера). Часть общей библиотеки ядра (`.forma/dashboard/lib/`).
 *
 * Карта лежит в `project/brief/sessions.json`, а не в кэше дашборда: сессия принадлежит разговору с человеком,
 * а не экрану, и переживает снос кэша. Значение позиции — список папок заходов, последний — текущий; строка —
 * старая форма записи. Служебный ключ `__absorbed` (докуда перенесены события каждой сессии) позицией не является.
 *
 * Без зависимостей, кроме встроенных модулей и `./fs.cjs`. `server.mjs` — ESM и подключает модуль по пути через
 * `createRequire`, поэтому здесь остаётся CommonJS.
 */

const fs = require('fs');
const path = require('path');
const { readJson } = require('./fs.cjs');

const ABSORBED_KEY = '__absorbed';

const sessionsFile = (projectRoot) => path.join(projectRoot, 'project', 'brief', 'sessions.json');

/** Карта сессий; файла нет или он битый — `{}`: интервью ещё не открывали. */
const readSessions = (projectRoot) => readJson(sessionsFile(projectRoot), {});

/** Запись карты целиком; каталог брифа создаётся, если его нет. */
function writeSessions(projectRoot, all) {
  const file = sessionsFile(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(all, null, 2), 'utf8');
}

/** Заходы позиции по порядку; последний — текущий. Строка — старая форма записи. */
const sessionList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const currentSession = (v) => sessionList(v).slice(-1)[0] || null;

/** Позиции карты с их заходами; служебный ключ пропущен. `[{ position, dirs }]`. */
function positionSessions(projectRoot) {
  return Object.entries(readSessions(projectRoot))
    .filter(([pos]) => pos !== ABSORBED_KEY)
    .map(([pos, raw]) => ({ position: Number(pos), dirs: sessionList(raw) }));
}

/** Номер последнего перенесённого события сессии; ничего не переносили — 0. */
const readAbsorbedSeq = (projectRoot, session) => Number((readSessions(projectRoot)[ABSORBED_KEY] || {})[session]) || 0;

function writeAbsorbedSeq(projectRoot, session, seq) {
  const all = readSessions(projectRoot);
  all[ABSORBED_KEY] = all[ABSORBED_KEY] || {};
  all[ABSORBED_KEY][session] = seq;
  writeSessions(projectRoot, all);
}

/** Жив ли процесс. Без pid — нет: `process.kill(0, 0)` означал бы группу процессов, а не этот сервер. */
function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/**
 * Адрес и живость сервера страницы сессии — по её `server.json`. Живость — по pid, а не по наличию файла:
 * файл остаётся на диске и после того, как процесс умер, и доверять ему значило бы показывать адрес, по которому никого нет.
 * Сервер ни разу не поднимался — `{ url: null, alive: false }`.
 */
function serverOf(dir) {
  const srv = readJson(path.join(dir, 'server.json'), null);
  if (srv === null) return { url: null, alive: false };
  return { url: srv.url || null, alive: alive(srv.pid) };
}

/**
 * Порт прошлого запуска — из `server.json` `{ port, pid, started }`. Нет файла или валидного числа — 0
 * (сигнал «нет запомненного»: вызывающий подставит свой порт по умолчанию или эфемерный).
 */
function rememberedPort(serverFile) {
  const p = Number((readJson(serverFile, null) || {}).port);
  return Number.isInteger(p) && p > 0 ? p : 0;
}

module.exports = {
  ABSORBED_KEY, sessionsFile, readSessions, writeSessions, sessionList, currentSession,
  positionSessions, readAbsorbedSeq, writeAbsorbedSeq, alive, serverOf, rememberedPort,
};
