// Модульные тесты dashboard/lib/fs.cjs: обход, JSON, чтение без падения.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { walk, readJson, writeJsonAtomic, readIfExists } = require('../skills/forma/core/dashboard/lib/fs.cjs');

let dir;
test.before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-fs-'));
  fs.mkdirSync(path.join(dir, 'a', 'b'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'skipme'));
  fs.writeFileSync(path.join(dir, 'top.md'), 'x');
  fs.writeFileSync(path.join(dir, 'a', 'one.md'), 'x');
  fs.writeFileSync(path.join(dir, 'a', 'two.txt'), 'x');
  fs.writeFileSync(path.join(dir, 'a', 'b', 'deep.md'), 'x');
  fs.writeFileSync(path.join(dir, 'skipme', 'hidden.md'), 'x');
});
test.after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

test('walk: все файлы, пути от корня через «/»', () => {
  assert.deepEqual(walk(dir).sort(), ['a/b/deep.md', 'a/one.md', 'a/two.txt', 'skipme/hidden.md', 'top.md']);
});

test('walk: ext оставляет файлы с окончанием', () => {
  assert.deepEqual(walk(dir, { ext: '.md' }).sort(), ['a/b/deep.md', 'a/one.md', 'skipme/hidden.md', 'top.md']);
});

test('walk: abs даёт абсолютные пути', () => {
  const files = walk(dir, { abs: true, ext: '.txt' });
  assert.deepEqual(files, [path.join(dir, 'a', 'two.txt')]);
});

test('walk: skip пропускает каталог вместе с содержимым; получает относительный путь', () => {
  const seen = [];
  const files = walk(dir, { skip: (e, rel) => { seen.push(rel); return e.isDirectory() && e.name === 'skipme'; } });
  assert.ok(!files.some((f) => f.startsWith('skipme/')));
  assert.ok(seen.includes('a/b'), 'skip видит путь каталога от корня');
});

test('walk: нет каталога — пустой список', () => {
  assert.deepEqual(walk(path.join(dir, 'нет-такого')), []);
});

test('walk: каталог, который не читается, падает, а с tolerant — пропускается', () => {
  const file = path.join(dir, 'top.md');
  assert.throws(() => walk(file));
  assert.deepEqual(walk(file, { tolerant: true }), []);
});

test('readJson: файл есть, нет, битый', () => {
  const ok = path.join(dir, 'ok.json');
  fs.writeFileSync(ok, '{"a":1}');
  fs.writeFileSync(path.join(dir, 'bad.json'), '{oops');
  assert.deepEqual(readJson(ok), { a: 1 });
  assert.equal(readJson(path.join(dir, 'нет.json')), null);
  assert.deepEqual(readJson(path.join(dir, 'нет.json'), {}), {});
  assert.deepEqual(readJson(path.join(dir, 'bad.json'), []), []);
});

test('writeJsonAtomic: отступ 2, перевод строки в конце, временного файла не остаётся', () => {
  const f = path.join(dir, 'out.json');
  writeJsonAtomic(f, { a: [1, 2] });
  assert.equal(fs.readFileSync(f, 'utf8'), JSON.stringify({ a: [1, 2] }, null, 2) + '\n');
  assert.ok(!fs.readdirSync(dir).some((n) => n.endsWith('.tmp')));
});

test('readIfExists: текст, или запасное значение', () => {
  assert.equal(readIfExists(path.join(dir, 'top.md')), 'x');
  assert.equal(readIfExists(path.join(dir, 'нет.md')), '');
  assert.equal(readIfExists(path.join(dir, 'нет.md'), null), null);
});
