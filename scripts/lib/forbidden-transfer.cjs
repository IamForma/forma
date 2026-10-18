'use strict';
// Пути, которые engine-to-protocol.cjs не переносит ни по --apply, ни по --add, ни попаданием в MAP:
// продуктовые зоны (project/, .devtool/, .forma/living/ — история и содержимое конкретного проекта)
// и записи .claude/project-layer.txt (слой 4 — собственные файлы движка, не портируемые).
const fs = require('fs');
const path = require('path');

const FORBIDDEN_PREFIX = ['project/', '.devtool/', '.forma/living/'];

/** Множество путей (файл или каталог — покрывает всё внутри) из .claude/project-layer.txt проекта `root`. */
function readOwnLayer(root) {
  const layerFile = path.join(root, '.claude', 'project-layer.txt');
  return new Set(fs.existsSync(layerFile)
    ? fs.readFileSync(layerFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    : []);
}

/** `rel` — путь от корня проекта с «/». `true` — переносить в протокол запрещено. */
function isForbiddenTransfer(rel, ownLayer) {
  if (FORBIDDEN_PREFIX.some((p) => rel === p.slice(0, -1) || rel.startsWith(p))) return true;
  for (const o of ownLayer) if (rel === o || rel.startsWith(o + '/')) return true;
  return false;
}

module.exports = { FORBIDDEN_PREFIX, readOwnLayer, isForbiddenTransfer };
