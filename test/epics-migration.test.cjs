// Миграция установленного проекта на новые коды и имена девяти видов цели: состояние, запись, повтор, откат, смешанное состояние.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'layout', 'epics-migrate-install.cjs');
const run = (root, ...a) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...a, '--root', root], { encoding: 'utf8' });
  let out = null;
  try { out = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { /* не JSON */ }
  return { code: r.status, out, raw: r.stdout + r.stderr };
};
const write = (root, rel, body) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-epics-'));
  write(root, 'project/goals/goal-value/GOAL.md', '# Goal\n');
  write(root, '.forma/manual/en/01-value/README.md', '# 1. Value\n');
  write(root, '.devtool/features/card-006-example.md', '---\nepic: "1. Value/Core"\nlabels: ["goal-value", "route-1"]\n---\n# card-006\n');
  return root;
}

test('старый проект: --check видит работу, --apply переносит каталоги, метки и имя эпика, повтор ничего не делает', () => {
  const root = fixture();
  try {
    assert.equal(run(root, '--check').code, 1);
    const applied = run(root, '--apply', '--allow-dirty');
    assert.equal(applied.code, 0, applied.raw);
    assert.ok(fs.existsSync(path.join(root, 'project/goals/goal-analytics/GOAL.md')));
    assert.ok(!fs.existsSync(path.join(root, 'project/goals/goal-value')));
    assert.ok(fs.existsSync(path.join(root, '.forma/manual/en/01-analytics/README.md')));
    const card = read(root, '.devtool/features/card-006-example.md');
    assert.match(card, /"goal-analytics"/);
    assert.match(card, /epic: "1\. Project analytics"/);
    assert.equal(run(root, '--check').code, 0);
    assert.equal(run(root, '--apply', '--allow-dirty').out.state, 'new');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('откат по журналу возвращает исходные байты и каталоги', () => {
  const root = fixture();
  try {
    const before = read(root, '.devtool/features/card-006-example.md');
    const applied = run(root, '--apply', '--allow-dirty');
    assert.equal(applied.code, 0, applied.raw);
    const journal = path.join(root, '.forma', 'living', 'migrations');
    const dir = path.join(journal, fs.readdirSync(journal)[0]);
    const back = run(root, '--rollback', dir);
    assert.equal(back.code, 0, back.raw);
    assert.equal(read(root, '.devtool/features/card-006-example.md'), before);
    assert.ok(fs.existsSync(path.join(root, 'project/goals/goal-value/GOAL.md')));
    assert.ok(!fs.existsSync(path.join(root, 'project/goals/goal-analytics')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('смешанное состояние — стоп, файлы не тронуты', () => {
  const root = fixture();
  try {
    write(root, 'project/goals/goal-analytics/GOAL.md', '# Goal\n');
    const r = run(root, '--apply', '--allow-dirty');
    assert.equal(r.code, 2, r.raw);
    assert.ok(fs.existsSync(path.join(root, 'project/goals/goal-value/GOAL.md')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('проект без девяти видов цели: делать нечего', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-epics-'));
  try { assert.equal(run(root, '--check').code, 0); } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
