// Порча файлов фикстуры с откатом: каждая правка запоминает исходное состояние файла
// (содержимое или «файла не было») и каталоги, созданные по пути; restore() возвращает всё как было.
const fs = require('node:fs');
const path = require('node:path');

const CRLF = String.fromCharCode(13, 10);
const LF = String.fromCharCode(10);

function mutator(root) {
  const undo = [];
  const abs = (rel) => path.join(root, ...rel.split('/'));

  function remember(rel) {
    const file = abs(rel);
    if (undo.some((u) => u.file === file)) return;
    const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
    const created = [];
    for (let d = path.dirname(file); !fs.existsSync(d); d = path.dirname(d)) created.push(d);
    undo.push({ file, before, created });
  }

  const read = (rel) => fs.readFileSync(abs(rel), 'utf8');
  function write(rel, text) {
    remember(rel);
    fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
    fs.writeFileSync(abs(rel), text);
  }
  // Правка текста в LF; переводы строк файла (CRLF после checkout на Windows) возвращаются как были.
  function edit(rel, fn) {
    const raw = read(rel);
    const crlf = raw.includes(CRLF);
    const out = fn(crlf ? raw.split(CRLF).join(LF) : raw);
    write(rel, crlf ? out.split(LF).join(CRLF) : out);
  }
  function remove(rel) {
    remember(rel);
    fs.rmSync(abs(rel));
  }
  function restore() {
    for (const u of undo.reverse()) {
      if (u.before === null) fs.rmSync(u.file, { force: true });
      else fs.writeFileSync(u.file, u.before);
      for (const d of u.created) fs.rmSync(d, { recursive: true, force: true });
    }
    undo.length = 0;
  }
  return { read, write, edit, remove, restore };
}

module.exports = { mutator };
