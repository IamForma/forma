#!/usr/bin/env node
// Автосборка графов Kit после правки файлов проекта: дебаунс и lock, без модели.
//   node .claude/scripts/auto-graphs.cjs touch     — отметить «грязно»; если воркера нет — запустить его отдельным процессом
//   node .claude/scripts/auto-graphs.cjs --worker  — внутренний: ждёт тишины, собирает, повторяет, пока метка свежее сборки
// Тишина — DEBOUNCE_MS без новых отметок; один воркер за раз — lock-файл (устаревший lock снимается).
// Сбой сборки не пробрасывается: хук не блокирует запись.

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, '.forma', 'dashboard', '.cache');
const STAMP = path.join(DIR, 'graphs-dirty');
const LOCK = path.join(DIR, 'graphs.lock');
const LOG = path.join(DIR, 'graphs-auto.log');
const DEBOUNCE_MS = Number(process.env.AUTO_GRAPHS_DEBOUNCE_MS) || 30000;
const STALE_LOCK_MS = 10 * 60 * 1000;
const POLL_MS = 2000;

const now = () => Date.now();
const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => { try { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + s + '\n'); } catch { /* журнал не обязателен */ } };

function mark() {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(STAMP, String(now()));
}

function takeLock() {
  fs.mkdirSync(DIR, { recursive: true });
  if (mtime(LOCK) && now() - mtime(LOCK) > STALE_LOCK_MS) { try { fs.unlinkSync(LOCK); } catch { /* занято другим */ } }
  try { fs.closeSync(fs.openSync(LOCK, 'wx')); return true; } catch { return false; }
}

const dropLock = () => { try { fs.unlinkSync(LOCK); } catch { /* уже снят */ } };

function touch() {
  mark();
  if (!takeLock()) return;                       // воркер уже ждёт или собирает — он увидит свежую метку
  const child = spawn(process.execPath, [__filename, '--worker'], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

async function worker() {
  try {
    for (;;) {
      while (now() - mtime(STAMP) < DEBOUNCE_MS) { fs.utimesSync(LOCK, new Date(), new Date()); await sleep(POLL_MS); }
      const started = now();
      const r = spawnSync(process.execPath, [path.join(__dirname, 'build-kit-graphs.cjs')], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
      log(r.status === 0 ? `ok ${Math.round((now() - started) / 1000)}s` : `fail code=${r.status} ${String(r.stderr || '').split('\n')[0]}`);
      if (mtime(STAMP) <= started) break;        // за время сборки правок не было — всё
    }
  } catch (err) { log('worker error ' + (err && err.message)); }
  finally { dropLock(); }
}

const cmd = process.argv[2];
if (cmd === 'touch') touch();
else if (cmd === '--worker') worker();
else { console.error('auto-graphs: touch | --worker'); process.exit(2); }
