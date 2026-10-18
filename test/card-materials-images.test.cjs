// Материалы карточек: изображение вне assets/ — находка при любом весе; внутри assets/ и work/ — нет.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const check = require('../skills/forma/core/board/checks/card-materials.cjs');

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-img-'));
  fs.mkdirSync(path.join(root, '.devtool', 'features'), { recursive: true });
  fs.writeFileSync(path.join(root, '.devtool', 'features', 'card-001-x.md'), '# x\n');
  return root;
}
const put = (root, rel) => {
  const f = path.join(root, 'project', 'cards', rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, 'x');
};

test('image next to card files is reported at any weight', () => {
  const root = project();
  put(root, 'card-001/shot.png');
  put(root, 'card-001/note.md');
  const out = check.run({ root });
  assert.equal(out.filter((p) => /shot\.png: изображение .* вне assets\//.test(p)).length, 1);
});

test('images inside assets/ and work/ are not reported', () => {
  const root = project();
  put(root, 'card-001/assets/shot.png');
  put(root, 'card-001/work/dump.jpg');
  assert.deepEqual(check.run({ root }), []);
});
