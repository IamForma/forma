#!/usr/bin/env node
// Одна проверка переезда, короткая сводка (≤30 строк), код выхода ≠0 при любом провале:
// старые пути вне исключений, check-board, generate.js, sync-engines --check, тесты протокола.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadMap, addMapSelfException, isExceptionFile, findMatches, readTextOrNull, listFiles } = require('./lib.cjs');

const HELP = `Применение: node layout-verify.cjs --map <layout-map.json> [--root <dir>]
Печатает не больше 30 строк; код выхода ≠0, если хоть одна проверка провалена.
`;

function firstExisting(root, candidates) {
  for (const c of candidates) { const p = path.join(root, c); if (fs.existsSync(p)) return p; }
  return null;
}

function run(cmd, args, cwd, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 180000, ...opts });
  if (r.error) return { code: 1, out: String(r.error.message || r.error) };
  return { code: r.status, out: ((r.stdout || '') + (r.stderr || '')).trim() };
}

// Только «точные» (путеподобные) совпадения — голое слово в прозе (спорное) не считается
// непереехавшим путём: `layout-rewrite --apply` его и не трогает.
function checkOldPaths(root, moves, exFiles, exDirs) {
  const hits = [];
  for (const rel of listFiles(root)) {
    if (isExceptionFile(rel, exFiles)) continue;
    const text = readTextOrNull(path.join(root, rel));
    if (text == null) continue;
    for (const mv of moves) {
      for (const m of findMatches(text, mv, exDirs, { relFile: rel, moves })) {
        if (!m.certain) continue;
        const line = text.slice(0, m.index).split('\n').length;
        hits.push(rel + ':' + line + ': «' + mv.from + '» не перенесено (ожидается «' + mv.to + '»)');
      }
    }
  }
  return hits;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }
  let root = process.cwd(), map = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--map') map = argv[++i];
  }
  if (!map) { console.error('СТОП: нужен --map <layout-map.json>.'); process.exit(2); }
  root = path.resolve(root);
  const { moves, exFiles, exDirs, mapFile } = loadMap(map);
  addMapSelfException(exFiles, root, mapFile);

  const lines = [];
  let fail = false;
  const fail1 = (name, detail) => { fail = true; lines.push('✗ ' + name + (detail ? ': ' + detail : '')); };
  const ok1 = (name) => lines.push('✓ ' + name);

  const oldHits = checkOldPaths(root, moves, exFiles, exDirs);
  if (oldHits.length) fail1('старые пути вне исключений', oldHits.length + ' совпадений, первое: ' + oldHits[0]);
  else ok1('старые пути вне исключений');

  const board = firstExisting(root, ['board/check-board.cjs', '.forma/board/check-board.cjs']);
  if (!board) fail1('check-board', 'скрипт не найден');
  else { const r = run(process.execPath, [board], root); r.code === 0 ? ok1('check-board') : fail1('check-board', r.out.split('\n').slice(-3).join(' / ')); }

  const gen = firstExisting(root, ['dashboard/generate.js', '.forma/dashboard/generate.js']);
  if (!gen) fail1('generate.js', 'скрипт не найден');
  else { const r = run(process.execPath, [gen], root); r.code === 0 ? ok1('generate.js') : fail1('generate.js', r.out.split('\n').slice(-3).join(' / ')); }

  const sync = firstExisting(root, ['.claude/scripts/sync-engines.cjs']);
  if (!sync) fail1('sync-engines --check', 'скрипт не найден');
  else { const r = run(process.execPath, [sync, '--check'], root); r.code === 0 ? ok1('sync-engines --check') : fail1('sync-engines --check', r.out.split('\n').slice(-3).join(' / ')); }

  const proto = firstExisting(root, ['protocol/package.json', '.forma/protocol/package.json']);
  if (!proto) fail1('тесты протокола', 'package.json не найден');
  else {
    const protoDir = path.relative(root, path.dirname(proto)) || '.';
    const r = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--prefix', protoDir, 'test'], root, { shell: process.platform === 'win32' });
    r.code === 0 ? ok1('тесты протокола') : fail1('тесты протокола', r.out.split('\n').slice(-3).join(' / '));
  }

  for (const l of lines.slice(0, 30)) console.log(l);
  process.exit(fail ? 1 : 0);
}

main();
