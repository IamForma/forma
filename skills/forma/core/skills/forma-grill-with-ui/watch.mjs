#!/usr/bin/env node
// Слежение за сессией, которое не умирает после первого события.
//
// `server.mjs wait` возвращает одно событие и завершается. Под фоновым наблюдателем это значит:
// пришёл ответ — слежение кончилось, и следующий ответ человека уходит в тишину.
// Незаметно ровно до того мгновения, когда агент отвлёкся на работу, — а отвлекается
// он всегда, потому что разбирать ответ и есть его работа. Человек в это время видит
// «ожидание агента» без предела и не может отличить отлучку от поломки.
//
// Здесь слежение живёт, пока живёт монитор, и говорит обо всём, что меняет положение:
// о каждом новом событии и о смерти сервера. Молчание тогда значит ровно одно —
// ничего не произошло.
//
//   node watch.mjs --session <dir> [--after N]
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dir = arg('--session');
const root = arg('--root');
if (!dir && !root) { console.error('нужен --session <dir> или --root <dir>'); process.exit(2); }
let after = Number(arg('--after', 0)) || 0;

// В режиме --root у каждой сессии свой счётчик: номера событий в них независимы.
const seenBySession = new Map();
const sessionDirs = () => {
  if (dir) return [dir];
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, e.name, 'events.jsonl')))
      .map((e) => path.join(root, e.name));
  } catch { return []; }
};

const readEvents = (d) => {
  try {
    return fs.readFileSync(path.join(d, 'events.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
};

// Что именно пришло, одной строкой: тип события, номер и по чему ответили. Полный
// текст лежит в events.jsonl — тащить его сюда значит засыпать агента байтами.
const describe = (e) => {
  const kinds = {};
  for (const a of e.actions || []) kinds[a.type] = (kinds[a.type] || 0) + 1;
  const qs = [...new Set((e.actions || []).map((a) => a.q).filter(Boolean))];
  const bits = Object.entries(kinds).map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join(', ');
  return `событие #${e.seq} · ${bits || e.type}${qs.length ? ' · ' + qs.join(' ') : ''}`;
};

const serverAlive = (d) => {
  try {
    const pid = JSON.parse(fs.readFileSync(path.join(d, 'server.json'), 'utf8')).pid;
    if (!pid) return true; // нечем проверить — не выдумываем тревогу
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === 'EPERM'; // живой, но чужой
  }
};

console.log(dir
  ? `слежу за сессией ${path.basename(dir)}, после #${after}`
  : `слежу за всеми сессиями проекта в ${path.basename(root)}`);

// В режиме --root уже лежащие события не пересказываются: монитор заводят, чтобы
// узнавать о новом, а вываливать на агента весь прошлый разговор — это шум.
if (root) for (const d of sessionDirs()) {
  seenBySession.set(d, Math.max(0, ...readEvents(d).map((e) => Number(e.seq) || 0)));
}

const tick = () => {
  const dirs = sessionDirs();
  for (const d of dirs) {
    const seen = dir ? after : (seenBySession.has(d) ? seenBySession.get(d) : 0);
    let last = seen;
    for (const e of readEvents(d)) {
      if (!e.seq || e.seq <= seen) continue;
      last = Math.max(last, e.seq);
      console.log((dir ? '' : path.basename(d) + ' · ') + describe(e));
    }
    if (dir) after = last; else seenBySession.set(d, last);
  }
  // Одна названная сессия кончилась вместе со своим сервером. В режиме --root
  // смерть одной сессии ничего не значит: остальные живут, и новые ещё будут.
  if (dir && !serverAlive(dir)) {
    console.log('сервер сессии остановлен — слежение закончено');
    process.exit(0);
  }
};

tick();
setInterval(tick, 1000);
