'use strict';

/**
 * Пять узлов и их оснастка по умолчанию — модель, усилие, число инструментов, доступ к внешней модели.
 * Источник — фронтматтер файлов ролей (каталог называет адаптер), а не файл конфигурации: опись не может
 * разойтись с действительностью, потому что она и есть действительность
 * (.forma/manual/en/03-forma/SCHEME.md, «Арсенала отдельным файлом нет»).
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('../lib/card.cjs');
const engines = require('../lib/engines.cjs');

/** Порядок узлов в таблицах. */
const NODE_ORDER = ['Intent', 'Spec', 'Kit', 'Run', 'Core'];

function nodeRow(rolesDir, label) {
  const file = path.join(rolesDir, `${label.toLowerCase()}.md`);
  if (!fs.existsSync(file)) return null;
  const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const tools = (fm.tools || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    node: label,
    model: fm.model || null,
    effort: fm.effort || null,
    toolCount: tools.length,
    externalModel: tools.some((t) => /external-model-bridge/i.test(t)),
  };
}

/** Оснастка пяти узлов; нет каталога ролей у адаптера — пусто. */
function readNodeConfig(projectRoot) {
  const rolesDir = engines.firstPath(projectRoot, 'rolesDir');
  if (!rolesDir) return [];
  return NODE_ORDER.map((label) => nodeRow(rolesDir, label)).filter(Boolean);
}

module.exports = { NODE_ORDER, readNodeConfig };
