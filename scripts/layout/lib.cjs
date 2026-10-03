'use strict';
// Общее для набора layout-*: чтение таблицы переезда, граница слова, идемпотентность, исключения.
// Ни путей, ни имён проекта здесь нет — всё приходит аргументом (layout-map.json, --root).

const fs = require('fs');
const path = require('path');

/** Таблица «старый путь → новый» и исключения; падает с понятным сообщением, если файла нет/он битый.
 * Автоматически, без записи в саму таблицу: (а) каталоги карточек с их
 * собственными таблицами переезда (card-NNN под project/cards) — там живут чужие layout-map, не трогать;
 * (б) сам файл таблицы (`file`) — он может лежать внутри дерева, которое обходит rewrite/verify, и не
 * должен быть переписан как обычный текст. (б) добавляется относительно `root` в `loadMap`'s caller —
 * см. `addMapSelfException`. */
function loadMap(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch { throw new Error('СТОП: таблица не найдена: ' + file); }
  let m;
  try { m = JSON.parse(raw); }
  catch (e) { throw new Error('СТОП: таблица не разбирается как JSON (' + file + '): ' + e.message); }
  if (!Array.isArray(m.moves)) throw new Error('СТОП: в таблице нет "moves" (' + file + ').');
  const exceptions = m.exceptions || {};
  const exFiles = [...(exceptions.files || []), 'project/cards/card-*/'];
  return { moves: m.moves, exFiles, exDirs: exceptions.dirs || [], mapFile: file };
}

/** Добавляет в `exFiles` путь самой таблицы переезда, посчитанный от `root`. */
function addMapSelfException(exFiles, root, mapFile) {
  const rel = path.relative(root, path.resolve(mapFile)).split(path.sep).join('/');
  if (!rel.startsWith('..')) exFiles.push(rel);
  return exFiles;
}

function patternToRegex(pattern) {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp('^' + esc);
}

/** Файл (путь от корня, через «/») не переписывается содержимо — попадает в исключения «история»
 * (суффикс `/` — префикс каталога, иначе точное имя) либо в шаблон с `*`. */
function isExceptionFile(rel, exFiles) {
  return exFiles.some((e) => {
    if (e.includes('*')) return patternToRegex(e).test(rel);
    return e.endsWith('/') ? rel.startsWith(e) : rel === e;
  });
}

const WORD = /[A-Za-z0-9_-]/;
const QUOTE_START = ['`', '"', "'", '(', '=', '[', '<']; // символы, после которых слово начинает путь
const QUOTE_END = ['`', '"', "'", ')'];

// «Точный» контекст без слеша/кавычки: слово — аргумент после `node` или `--prefix`
// (`node protocol/x`, `npm --prefix protocol test`). Проверяется по тексту перед совпадением.
const CONTEXT_CERTAIN = /(?:^|[^A-Za-z0-9_.-])(?:node|--prefix)[ \t]+$/;

// Имя файла, не каталога: сразу после совпадения — `.` и буква расширения (`board.cjs`, `./data/board.cjs`).
// Директории точек в именах не носят — совпадение здесь не про путь-каталог, а про основу имени файла
//: такое совпадение не трогаем вовсе, не считаем даже спорным.
const FILE_EXT_AFTER = /^\.[A-Za-z][A-Za-z0-9]{0,6}(?![A-Za-z0-9_-])/;

/** Соседская относительная ссылка (`../dashboard`, `./x`) из файла, который сам переезжает в этом же
 * наборе: все цели таблицы переезжают под один новый корень, значит относительная
 * связь между движущимися деревьями не меняется — её не трогаем. */
// Проверяется и по старому, и по новому пути: `layout-rewrite --apply` сначала делает `git mv`
// (doMoves), и только потом правит текст — к моменту правки файл уже лежит по `to`, не по `from`.
function isMovingFile(relFile, moves) {
  return moves.some((m) =>
    relFile === m.from || relFile.startsWith(m.from + '/') ||
    relFile === m.to || relFile.startsWith(m.to + '/'));
}

/**
 * Совпадения `from` в тексте на границе слова, с разбором на «точные» (со слешем, в кавычках,
 * после `node`/`--prefix`) и «спорные» (голое слово в прозе) и фильтром уже перенесённых
 * (`to` оканчивается на `from` — пропускаем, если перед совпадением уже стоит этот префикс:
 * идемпотентность), чужих каталогов (`exDirs`, например `.claude/skills/`), имён файлов
 * (`ctx.relFile`'s own text, FILE_EXT_AFTER) и соседских относительных ссылок (`isMovingFile`).
 * @param {{from:string,to:string}} mv — текущая пара переезда (сведено в один объект, max-params).
 * @param {object} [ctx] — { relFile: string, moves: Array<{from,to}> }.
 * @returns {{index:number, certain:boolean}[]}
 */
function findMatches(text, mv, exDirs, ctx = {}) {
  const { from, to } = mv;
  const out = [];
  const toPrefix = to.length > from.length && to.endsWith(from) ? to.slice(0, to.length - from.length) : null;
  let i = 0;
  while ((i = text.indexOf(from, i)) !== -1) {
    const before = i > 0 ? text[i - 1] : '';
    const after = i + from.length < text.length ? text[i + from.length] : '';
    const okBoundary = !WORD.test(before) && !WORD.test(after);
    if (!okBoundary) { i += 1; continue; }
    // уже перенесено (например ".forma/skills" при from="skills") — не трогаем
    if (toPrefix && text.slice(i - toPrefix.length, i) === toPrefix) { i += from.length; continue; }
    // чужой каталог: исключение оканчивается на from (".claude/skills/" → "skills")
    const foreign = exDirs.some((d) => {
      const base = d.replace(/\/$/, '');
      if (!base.endsWith(from)) return false;
      const prefix = base.slice(0, base.length - from.length);
      return text.slice(i - prefix.length, i) === prefix;
    });
    if (foreign) { i += from.length; continue; }
    // имя файла, не каталог: "board.cjs", "./data/board.cjs" — не трогаем вовсе
    if (FILE_EXT_AFTER.test(text.slice(i + from.length))) { i += from.length; continue; }
    // соседская относительная ссылка внутри своего же переезжающего дерева — связь уже верна
    const relCtx = text.slice(Math.max(0, i - 3), i);
    const isRelCtx = relCtx.endsWith('../') || relCtx.endsWith('./');
    if (isRelCtx && ctx.relFile && ctx.moves && isMovingFile(ctx.relFile, ctx.moves)) { i += from.length; continue; }
    // «точное»: путевой контекст хотя бы с одной стороны (/, кавычка, обратная кавычка) или границы текста,
    // либо слово стоит аргументом после `node`/`--prefix` (без слеша, но всё равно путь).
    // Слово — путь только там, где путь может начаться: в начале текста, после кавычки/скобки/`./`/`../`, либо аргументом
    // `node`/`--prefix`. Середина чужого пути («mattpocock/skills», «pages/templates/blocks»), слово в прозе и ключ
    // с двоеточием («`skills:`») — спорные: текст не трогаем.
    const startsPath = before === '' || QUOTE_START.includes(before) ||
      (before === '/' && !WORD.test(text[i - 2] || ''));
    const endsPath = after === '' || after === '/' || QUOTE_END.includes(after);
    const certain = (startsPath && endsPath) || CONTEXT_CERTAIN.test(text.slice(Math.max(0, i - 24), i));
    out.push({ index: i, certain });
    i += from.length;
  }
  return out;
}

/** Файл — не бинарный (нет `\0` в первых 8000 байт) и читается как utf8. */
function readTextOrNull(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch { return null; }
  if (buf.subarray(0, 8000).includes(0)) return null;
  return buf.toString('utf8');
}

/** Список файлов от git (отслеживаемые) или, если не git, обычный рекурсивный обход без `.git`. */
function listFiles(root) {
  const { gitOut } = require('../lib/git.cjs');
  try {
    const tracked = gitOut(root, 'ls-files', '-z').split('\0').filter(Boolean);
    const untracked = gitOut(root, 'ls-files', '-z', '--others', '--exclude-standard').split('\0').filter(Boolean);
    return [...new Set([...tracked, ...untracked])];
  } catch {
    const { walk } = require('../../skills/forma/core/dashboard/lib/fs.cjs');
    return walk(root, { skip: (e, rel) => rel === '.git' || rel.endsWith('/.git') });
  }
}

module.exports = { loadMap, addMapSelfException, isExceptionFile, findMatches, readTextOrNull, listFiles };
