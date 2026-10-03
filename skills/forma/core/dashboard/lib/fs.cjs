'use strict';

/**
 * Файлы: обход дерева, JSON, чтение без падения. Часть общей библиотеки ядра (`.forma/dashboard/lib/`).
 * Ни одной зависимости, кроме встроенных модулей: ядро, адаптеры и установщик подключают её по пути.
 */

const fs = require('fs');
const path = require('path');

/**
 * Рекурсивный обход, вглубь, в порядке `readdir` (каталоги и файлы вперемешку — как читает диск).
 * Символические ссылки не разворачиваются: ссылка — не каталог и не обычный файл (`Dirent`).
 * Каталога нет — `[]`.
 *
 * @param {string} dir
 * @param {object} [o]
 * @param {string} [o.ext] — оставить только файлы с этим окончанием имени (`.md`)
 * @param {(entry: fs.Dirent, rel: string) => boolean} [o.skip] — пропустить запись (каталог — вместе с содержимым);
 *   `rel` — путь от `dir` через `/`
 * @param {boolean} [o.abs] — вернуть абсолютные пути (по умолчанию — от `dir`, через `/`)
 * @param {boolean} [o.tolerant] — каталог, который не читается, пропустить, а не упасть
 * @param {boolean} [o.symlinks] — считать файлом всё, что не каталог (в том числе ссылку)
 * @returns {string[]}
 */
function walk(dir, o = {}) {
  const out = [];
  const isFile = o.symlinks ? (e) => !e.isDirectory() : (e) => e.isFile();
  const visit = (abs, rel) => {
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); }
    catch (err) { if (o.tolerant || err.code === 'ENOENT') return; throw err; }
    for (const e of entries) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (o.skip && o.skip(e, r)) continue;
      if (e.isDirectory()) { visit(path.join(abs, e.name), r); continue; }
      if (!isFile(e)) continue;
      if (o.ext && !e.name.endsWith(o.ext)) continue;
      out.push(o.abs ? path.join(dir, r) : r);
    }
  };
  visit(dir, '');
  return out;
}

/** JSON-файл; нет файла или он битый — `fallback`. */
function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

/** Запись через временный файл и переименование: читатель не увидит половину файла. Отступ 2, конец строки. */
function writeJsonAtomic(file, obj) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/** Текст файла; файла нет или он не читается — `fallback` (по умолчанию пустая строка). */
function readIfExists(file, fallback = '') {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return fallback; }
}

module.exports = { walk, readJson, writeJsonAtomic, readIfExists };
