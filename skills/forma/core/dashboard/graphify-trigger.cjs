#!/usr/bin/env node
// Счётчик накопления для авто-триггера graphify — читает graphify.config.json,
// смотрит, сколько новых событий набежало с последнего запуска /graphify
// (по последней строке .forma/dashboard/graphify.log), и при превышении порога
// помечает граф как «пора пересобрать» (.forma/dashboard/.cache/graphify-pending.json).
//
// Запуск: node .forma/dashboard/graphify-trigger.cjs   (обычно — из watch.js, тем же порядком,
// что и watchFeatures()/watchGraphifyLog() в serve.js; можно и вручную).

const fs = require('fs');
const path = require('path');
const { walk } = require('./lib/fs.cjs');
const engines = require('./lib/engines.cjs');

const ROOT = __dirname;
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
// Только закрытые карточки (done/), не вся доска — живая доска (backlog/todo/in-progress/review)
// меняется на каждом шаге круга, это другой, гораздо более дорогой и волатильный корпус
//.
const FEATURES_DIR = path.join(PROJECT_ROOT, '.devtool', 'features', 'done');
const CONFIG_FILE = path.join(ROOT, 'graphify.config.json');
const LOG_FILE = path.join(ROOT, 'graphify.log');
const CACHE_DIR = path.join(ROOT, '.cache');
const PENDING_FILE = path.join(CACHE_DIR, 'graphify-pending.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch (err) { console.error(`graphify-trigger: битый ${path.relative(PROJECT_ROOT, CONFIG_FILE)} (${err.message})`); return null; }
}

// Последняя строка graphify.log — формат `AGENTS.md`: "ГГГГ-ММ-ДД ЧЧ:ММ | mode=... | ...".
// Если лога ещё нет — считаем точкой отсчёта эпоху (0), то есть все существующие карточки в зачёт.
function lastRunAt() {
  if (!fs.existsSync(LOG_FILE)) return 0;
  const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').map(l => l.trim()).filter(Boolean).filter(l => !l.startsWith('#'));
  if (!lines.length) return 0;
  const m = lines[lines.length - 1].match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
  if (!m) return 0;
  return new Date(`${m[1]}T${m[2]}:00`).getTime();
}

// Считает markdown-файлы закрытых карточек (done/) с mtime новее lastRun — приближение
// к «новых событий N»: и закрытие карточки, и новая строка History трогают mtime файла.
function countAccumulatedEvents(sinceMs) {
  if (!fs.existsSync(FEATURES_DIR)) return 0;
  return walk(FEATURES_DIR, { ext: '.md', symlinks: true, abs: true })
    .filter((file) => fs.statSync(file).mtimeMs > sinceMs).length;
}

function writePending(reason, count, threshold) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify({
    pending: true,
    reason,
    accumulatedEvents: count,
    threshold,
    since: new Date().toISOString(),
  }, null, 2), 'utf8');
}

function clearPending() {
  if (fs.existsSync(PENDING_FILE)) fs.unlinkSync(PENDING_FILE);
}

function check() {
  const config = loadConfig();
  if (!config || config.trigger?.mode !== 'history-accumulation') { clearPending(); return; }

  const threshold = config.trigger.threshold ?? 20;
  const since = lastRunAt();
  const count = countAccumulatedEvents(since);

  if (count < threshold) { clearPending(); return; }

  // Графы механические; хук только помечает «пора пересобрать».
  writePending('threshold-reached-awaiting-manual-run', count, threshold);
  console.log(`graphify-trigger: накоплено ${count} событий (порог ${threshold}) — граф помечен как «пора пересобрать» (${path.relative(PROJECT_ROOT, PENDING_FILE)}), запустите node .claude/scripts/build-kit-graphs.cjs.`);
}

module.exports = { check };

// Вызван напрямую (`node .forma/dashboard/graphify-trigger.cjs`), не через require() из serve.js.
if (require.main === module) check();
