// Модульные тесты adapters/claude/scripts/checks/support/clean-zone.cjs: запись слоя 4
// (.claude/project-layer.txt), указывающая каталог, должна выводить из проверки все файлы внутри,
// не только точное совпадение пути.
const test = require('node:test');
const assert = require('node:assert/strict');
const { isOwn, inCleanZone } = require('../skills/forma/adapters/claude/scripts/checks/support/clean-zone.cjs');

test('isOwn: точное совпадение файла', () => {
  const own = new Set(['.claude/scripts/po_shift_check.py']);
  assert.equal(isOwn('.claude/scripts/po_shift_check.py', own), true);
  assert.equal(isOwn('.claude/scripts/other.py', own), false);
});

test('isOwn: запись-каталог покрывает файлы внутри', () => {
  const own = new Set(['.claude/skills/novamira-wp-deploy']);
  assert.equal(isOwn('.claude/skills/novamira-wp-deploy', own), true);
  assert.equal(isOwn('.claude/skills/novamira-wp-deploy/SKILL.md', own), true);
  assert.equal(isOwn('.claude/skills/novamira-wp-deploy-other/SKILL.md', own), false);
});

test('inCleanZone: файл внутри каталога слоя 4 не проверяется на следы проекта', () => {
  const own = new Set(['.claude/skills/novamira-wp-deploy']);
  assert.equal(inCleanZone('.claude/skills/novamira-wp-deploy/SKILL.md', own), false);
  // соседний скилл той же чистой зоны — проверяется как обычно
  assert.equal(inCleanZone('.claude/skills/novamira-wp-elementor/SKILL.md', own), true);
});
