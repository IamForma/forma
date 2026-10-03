'use strict';

/**
 * Вкладка «Форма»: по вкладке на каждый установленный движок — карточка узла и карточка роли Run
 * (модель, tier, effort, скиллы, коннекторы, плагины). «Установлен» = в корне есть каталог с точкой
 * и `forma-adapter.cjs` с полем `formaRoles` (шапка `.forma/dashboard/lib/engines.cjs`). Ядро не знает ни имён
 * движков, ни форматов их файлов: срез ролей собирает адаптер (общие разборщики — `lib/forma-roles.cjs`).
 * Адаптер, чей `formaRoles` бросил, пропускается — остальные вкладки живут.
 * Только показ: опись не хранится отдельно, это срез тех же файлов (kit.md, «Арсенал»).
 */

const engines = require('../lib/engines.cjs');

/** Claude Code идёт первым — он основной движок проекта; остальные — по имени каталога адаптера. */
const FIRST_ENGINE = 'claude-code';

function readEngineTab(adapter, projectRoot) {
  let cat;
  try { cat = adapter.formaRoles(projectRoot); } catch { return null; }
  if (!cat || typeof cat !== 'object') return null;
  return {
    engine: adapter.engine || engines.UNKNOWN,
    dir: adapter.dir,
    title: cat.title || adapter.engine || adapter.dir,
    nodes: cat.nodes || [],
    runRoles: cat.runRoles || [],
    runNote: cat.runNote || null,
    rolesMissing: !!cat.rolesMissing,
    plugins: cat.plugins || null,
  };
}

/** Срез вкладки «Форма»: `{ engines: [{ engine, dir, title, nodes, runRoles, runNote, rolesMissing, plugins }] }`. */
function readFormaCatalog(projectRoot) {
  const tabs = engines.loadAdapters(projectRoot)
    .filter((a) => typeof a.formaRoles === 'function')
    .map((a) => readEngineTab(a, projectRoot))
    .filter(Boolean)
    .sort((a, b) => (b.engine === FIRST_ENGINE) - (a.engine === FIRST_ENGINE));
  return { engines: tabs };
}

module.exports = { readFormaCatalog };
