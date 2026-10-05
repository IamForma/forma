'use strict';

// Чистые зоны (запрет 16): в файлах, что уезжают в другие проекты, нет следов проекта. Зоны, слой 4 и сам поиск
// следов — support/clean-zone.cjs.

const fs = require('fs');
const path = require('path');
const { walk } = require('../../../.forma/dashboard/lib/fs.cjs');
const { CLEAN_ROOTS, CLEAN_SKIP, cleanOwn, inCleanZone, scanCleanFile } = require('./support/clean-zone.cjs');

/** Обход корня зоны `rel` (файл или каталог); слой 4 и служебные каталоги пропускаются. */
function scanRoot(root, rel, own) {
  const problems = [];
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs) || own.has(rel)) return problems;
  const scanFile = (r) => {
    if (inCleanZone(r, own)) problems.push(...scanCleanFile(r, fs.readFileSync(path.join(root, r), 'utf8')));
  };
  if (!fs.statSync(abs).isDirectory()) { scanFile(rel); return problems; }
  const skip = (e, r) => CLEAN_SKIP.has(e.name) || e.name.startsWith('.') || own.has(rel + '/' + r);
  for (const r of walk(abs, { symlinks: true, skip })) scanFile(rel + '/' + r);
  return problems;
}

function run({ root }) {
  const own = cleanOwn(root);
  const problems = CLEAN_ROOTS.flatMap((rel) => scanRoot(root, rel, own));
  const proto = path.join(root, '.forma/protocol');
  if (fs.existsSync(proto)) {
    for (const e of fs.readdirSync(proto)) if (/^README[^/]*\.md$/.test(e)) problems.push(...scanRoot(root, '.forma/protocol/' + e, own));
  }
  return problems;
}

module.exports = { id: 'engine-impersonal', since: null, run };
