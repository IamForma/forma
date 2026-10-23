'use strict';

/**
 * Пять узлов и их оснастка по движкам — модель, усилие (из `nodeModels` адаптера), число инструментов и доступ
 * к внешней модели (из фронтматтера файла роли в каталоге ролей того же адаптера). Строка несёт `engine`.
 * Движок без `nodeModels` даёт одну пустую строку (`empty: true`) — пустая группа, а не падение.
 * Ни одно имя движка не сравнивается: список движков — это список адаптеров (.forma/manual/en/03-protocol/SCHEME.md).
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('../lib/card.cjs');
const engines = require('../lib/engines.cjs');

/** Порядок узлов в таблицах. */
const NODE_ORDER = ['Intent', 'Spec', 'Kit', 'Run', 'Core'];

/** Инструменты роли: `{ toolCount, externalModel }`; нет каталога или файла — 0 и false. */
function toolsOf(rolesDir, label) {
  const file = rolesDir ? path.join(rolesDir, `${label.toLowerCase()}.md`) : null;
  if (!file || !fs.existsSync(file)) return { toolCount: 0, externalModel: false };
  const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const tools = (fm.tools || '').split(',').map((s) => s.trim()).filter(Boolean);
  return { toolCount: tools.length, externalModel: tools.some((t) => /external-model-bridge/i.test(t)) };
}

const emptyRow = (engine) => ({ engine, node: null, model: null, effort: null, toolCount: 0, externalModel: false, empty: true });

/** Оснастка пяти узлов по всем адаптерам; нет адаптеров — пусто. */
function readNodeConfig(projectRoot) {
  const tables = engines.nodeModelTables(projectRoot);
  const rows = [];
  for (const t of tables) {
    const rolesDir = t.rolesDir ? engines.resolveRel(projectRoot, t.rolesDir) : null;
    for (const label of NODE_ORDER) {
      const m = t.nodeModels[label];
      if (!m) continue;
      rows.push({ engine: t.tag, node: label, model: m.model || null, effort: m.effort || null, ...toolsOf(rolesDir, label) });
    }
  }
  for (const e of engines.engineTags(projectRoot)) {
    if (!tables.some((t) => e.aliases.includes(t.tag))) rows.push(emptyRow(e.tag));
  }
  return rows;
}

module.exports = { NODE_ORDER, readNodeConfig };
