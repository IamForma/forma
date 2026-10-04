// Модульные тесты scripts/lib/forbidden-transfer.cjs: что engine-to-protocol.cjs не переносит
// в протокол ни по --apply, ни по --add, ни попаданием в MAP.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readOwnLayer, isForbiddenTransfer, FORBIDDEN_PREFIX } = require('../scripts/lib/forbidden-transfer.cjs');

test('FORBIDDEN_PREFIX покрывает продуктовые зоны', () => {
  assert.deepEqual(FORBIDDEN_PREFIX, ['project/', '.devtool/', '.forma/living/']);
});

test('isForbiddenTransfer: product/board/living-зоны запрещены вне зависимости от слоя 4', () => {
  const own = new Set();
  assert.equal(isForbiddenTransfer('project/config/SITE.md', own), true);
  assert.equal(isForbiddenTransfer('project', own), true);
  assert.equal(isForbiddenTransfer('.devtool/features/card-001.md', own), true);
  assert.equal(isForbiddenTransfer('.forma/living/CHANGELOG.md', own), true);
  assert.equal(isForbiddenTransfer('.claude/agents/core.md', own), false);
});

test('isForbiddenTransfer: запись слоя 4 — путь к файлу или к каталогу, каталог покрывает всё внутри', () => {
  const own = new Set(['.claude/skills/novamira-wp-deploy', '.claude/scripts/po_shift_check.py']);
  assert.equal(isForbiddenTransfer('.claude/skills/novamira-wp-deploy', own), true);
  assert.equal(isForbiddenTransfer('.claude/skills/novamira-wp-deploy/SKILL.md', own), true);
  assert.equal(isForbiddenTransfer('.claude/scripts/po_shift_check.py', own), true);
  assert.equal(isForbiddenTransfer('.claude/skills/novamira-wp-elementor/SKILL.md', own), false);
});

test('readOwnLayer: строки .claude/project-layer.txt без комментариев и пустых строк', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'own-layer-'));
  try {
    fs.mkdirSync(path.join(dir, '.claude'));
    fs.writeFileSync(path.join(dir, '.claude', 'project-layer.txt'), '# комментарий\n\n.claude/scripts/a.cjs\n.claude/skills/b\n');
    assert.deepEqual(readOwnLayer(dir), new Set(['.claude/scripts/a.cjs', '.claude/skills/b']));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readOwnLayer: файла нет — пустое множество', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'own-layer-empty-'));
  try {
    assert.deepEqual(readOwnLayer(dir), new Set());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
