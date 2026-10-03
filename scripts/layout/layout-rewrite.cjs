#!/usr/bin/env node
// Переезд дерева по таблице «старый путь → новый» (аргумент --map).
// --dry  — ничего не пишет: число файлов и замен, отдельно список спорных совпадений.
// --apply — `git mv` по таблице + замены путей по границам слова в тексте всех отслеживаемых файлов.
// Исключения (история, чужие каталоги) и идемпотентность (повторный --apply = 0 замен) — lib.cjs.
'use strict';
const fs = require('fs');
const path = require('path');
const { gitRun, gitOut } = require('../lib/git.cjs');
const { loadMap, addMapSelfException, isExceptionFile, findMatches, readTextOrNull, listFiles } = require('./lib.cjs');

const HELP = `Применение: node layout-rewrite.cjs --map <layout-map.json> [--root <dir>] (--dry|--apply) [--exclude <dir> ...]

  --map <file>   таблица переезда (обязательно; moves[], exceptions.files[], exceptions.dirs[])
  --root <dir>   корень дерева (по умолчанию текущий каталог)
  --dry          отчёт: файлов и замен, отдельно спорные совпадения; ничего не пишет
  --apply        git mv по таблице + замены в тексте; повторный запуск даёт 0 замен
  --exclude <dir> каталог (с хвостовым «/» или без), чей текст --apply/--dry не трогает вовсе;
                  повторяемый флаг; не пишет в саму таблицу
  --help         эта справка
`;

function parseArgs(argv) {
  const a = { root: process.cwd(), exclude: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--help' || t === '-h') a.help = true;
    else if (t === '--dry') a.dry = true;
    else if (t === '--apply') a.apply = true;
    else if (t === '--map') a.map = argv[++i];
    else if (t === '--root') a.root = argv[++i];
    else if (t === '--exclude') a.exclude.push(argv[++i]);
    else throw new Error('СТОП: неизвестный аргумент ' + t);
  }
  return a;
}

// Есть ли в индексе git хоть один отслеживаемый файл под `rel`: git mv
// требует отслеживаемый путь, иначе падает «source directory is empty» — свежий `git init`
// без коммита/add и каталог без git вовсе дают пустой индекс одинаково.
function hasTrackedFiles(root, rel) {
  try { return gitOut(root, 'ls-files', '--', rel).trim().length > 0; } catch { return false; }
}

// git mv по таблице (только --apply; существующие пути; идемпотентно — нет пути, пропуск).
// Отслеживаемый путь — git mv; неотслеживаемый (git без коммита/add, или каталог без git вовсе) —
// обычный fs-перенос (rename), сохраняющий содержимое байт-в-байт. Откат при сбое — предыдущие
// перенесённые каталоги в этом же вызове возвращаются на место тем же способом, каким переехали.
function doMoves(root, moves, apply) {
  const moved = [];
  if (!apply) return moved;
  const rollback = () => {
    for (const mv of moved.slice().reverse()) {
      if (mv.via === 'git') gitRun(root, 'mv', mv.to, mv.from);
      else { try { fs.renameSync(path.join(root, mv.to), path.join(root, mv.from)); } catch { /* best effort */ } }
    }
  };
  for (const mv of moves) {
    const from = path.join(root, mv.from);
    const to = path.join(root, mv.to);
    if (!fs.existsSync(from) || fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (hasTrackedFiles(root, mv.from)) {
      const r = gitRun(root, 'mv', mv.from, mv.to);
      if (r.code !== 0) { rollback(); console.error('СТОП: git mv ' + mv.from + ' → ' + mv.to + ' упал:\n' + r.out); process.exit(1); }
      moved.push({ ...mv, via: 'git' });
    } else {
      try { fs.renameSync(from, to); }
      catch (e) { rollback(); console.error('СТОП: перенос ' + mv.from + ' → ' + mv.to + ' упал:\n' + e.message); process.exit(1); }
      moved.push({ ...mv, via: 'fs' });
    }
  }
  return moved;
}

// Замены в тексте: применяются только «точные» (путеподобные) совпадения; «спорные»
// (голое слово в прозе) не трогаются, только считаются в отчёт (rel -> Map(word -> count)).
function rewriteFiles(root, map, apply) {
  const { moves, exFiles, exDirs } = map;
  const files = listFiles(root);
  let filesChanged = 0, replacements = 0, certain = 0, spornye = 0;
  const spornyeByFile = new Map();
  for (const rel of files) {
    if (isExceptionFile(rel, exFiles)) continue;
    const abs = path.join(root, rel);
    const text = readTextOrNull(abs);
    if (text == null) continue;
    let out = '', last = 0, fileHits = 0;
    const allMatches = [];
    for (const mv of moves) for (const mt of findMatches(text, mv, exDirs, { relFile: rel, moves })) allMatches.push({ ...mt, mv });
    allMatches.sort((x, y) => x.index - y.index);
    for (const m of allMatches) {
      if (m.index < last) continue; // перехлёст (не должен случаться — границы слова разделяют from'ы)
      if (!m.certain) {
        spornye++;
        const byWord = spornyeByFile.get(rel) || new Map();
        byWord.set(m.mv.from, (byWord.get(m.mv.from) || 0) + 1);
        spornyeByFile.set(rel, byWord);
        continue; // текст не трогаем, `last` не двигаем — голое слово остаётся как есть
      }
      out += text.slice(last, m.index) + m.mv.to;
      last = m.index + m.mv.from.length;
      fileHits++; replacements++; certain++;
    }
    out += text.slice(last);
    if (fileHits) {
      filesChanged++;
      if (apply) fs.writeFileSync(abs, out, 'utf8');
    }
  }
  return { filesChanged, replacements, certain, spornye, spornyeByFile };
}

function printReport(root, moves, moved, rw) {
  const dry = rw.dry;
  if (!dry) {
    console.log('git mv: ' + moved.length + '. Файлов изменено: ' + rw.filesChanged + '. Замен: ' + rw.replacements +
      ' (точных: ' + rw.certain + '). Спорных (не тронуты): ' + rw.spornye + '.');
    return;
  }
  console.log('Файлов для правки: ' + rw.filesChanged + '. Замен: ' + rw.replacements + ' (точных: ' + rw.certain +
    '). Спорных (не тронуты): ' + rw.spornye + ' в ' + rw.spornyeByFile.size + ' файлах.');
  const entries = [...rw.spornyeByFile.entries()];
  const LIMIT = 20;
  for (const [rel, byWord] of entries.slice(0, LIMIT)) {
    const parts = [...byWord.entries()].map(([w, c]) => '«' + w + '» ×' + c);
    console.log('  ' + rel + ': ' + parts.join(', '));
  }
  if (entries.length > LIMIT) console.log('  … ещё ' + (entries.length - LIMIT) + ' файлов.');
  console.log('Каталогов для git mv: ' + moves.filter((mv) => fs.existsSync(path.join(root, mv.from)) && !fs.existsSync(path.join(root, mv.to))).length + '.');
  console.log('Ничего не записано (--dry).');
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || process.argv.length <= 2) { console.log(HELP); process.exit(a.help ? 0 : 1); }
  if (!a.map) { console.error('СТОП: нужен --map <layout-map.json>.'); process.exit(2); }
  if (!a.dry && !a.apply) { console.error('СТОП: нужен --dry или --apply.'); process.exit(2); }
  const { moves, exFiles, exDirs, mapFile } = loadMap(a.map);
  const root = path.resolve(a.root);
  addMapSelfException(exFiles, root, mapFile);
  for (const d of a.exclude) exFiles.push(d.endsWith('/') ? d : d + '/');

  const moved = doMoves(root, moves, a.apply);
  const rw = rewriteFiles(root, { moves, exFiles, exDirs }, a.apply);
  rw.dry = a.dry;
  printReport(root, moves, moved, rw);
}

main();
