'use strict';

// Спящие движки: реестр `.forma/engines.json` (`{ "dormant": ["codex"] }`). Спящий движок остаётся в проекте как есть,
// но не сверяется и не пересобирается; пробуждение — убрать его из списка и выполнить сверку-пересборку движка.
// Нет файла или он не читается — спящих нет.

const fs = require('fs');
const path = require('path');

function dormantEngines(root) {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(root, '.forma', 'engines.json'), 'utf8')).dormant;
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

const isDormant = (root, id) => dormantEngines(root).includes(id);

module.exports = { dormantEngines, isDormant };
