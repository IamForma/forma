#!/usr/bin/env node
// Пересобирает срез по эпикам/карточкам/расходу из .devtool/features/**/*.md.
// Не хранилище — кэш: карточки остаются единственной правдой (AGENTS.md §3, «Расход считается по факту»).
// .forma/dashboard/ — не часть .devtool/ (та принадлежит расширению Kanban Markdown, .devtool/features/);
// это отдельный инструмент арсенала в корне проекта, просто читающий .devtool/features/.
// Экспортирует buildData() для serve.js (живой пересчёт без записи файла) и работает как CLI:
// Запуск: node .forma/dashboard/generate.js  →  .forma/dashboard/.cache/data.json
//
// Здесь только компоновка: каждая вкладка читается своим модулем из `data/`
// (карточки и заходы, расход, graphify, подагенты, интервью, настройки, маршруты, доска).
// Всё, что знает только движок, ядро берёт у адаптера через `lib/engines.cjs`; нет адаптера или поля —
// в данных `unknown`, остальные величины не страдают.

const fs = require('fs');
const path = require('path');

// Сервер горячо перезагружает только этот файл, поэтому модули `data/` при каждой загрузке читаются заново.
const DATA_DIR = path.join(__dirname, 'data') + path.sep;
for (const key of Object.keys(require.cache)) {
  if (key.startsWith(DATA_DIR)) delete require.cache[key];
}

const { readSpendCards, groupEpics, cardTotals } = require('./data/cards.cjs');
const { buildSpend } = require('./data/spend.cjs');
const { readNodeConfig } = require('./data/nodes.cjs');
const { readFormaCatalog } = require('./data/forma.cjs');
const { buildGraphify, graphsBuilt } = require('./data/graphify.cjs');
const { readSessionEconomy, readDialog } = require('./data/dialog.cjs');
const { readSubagentsRegistry } = require('./data/subagents.cjs');
const { buildBort } = require('./data/bort.cjs');
const { buildChain } = require('./data/chain.cjs');
const { readInterview } = require('./data/interview.cjs');
const { readProjectSettings, readEngineSettings } = require('./data/settings.cjs');
const { buildBoard } = require('./data/board.cjs');
const { buildDocs } = require('./data/docs.cjs');

/** Дерево структуры перечитывается каждый раз: сервер горячо перезагружает только `generate.js`. */
function readStructure(projectRoot) {
  delete require.cache[require.resolve('./structure.cjs')];
  return require('./structure.cjs').buildStructure(projectRoot);
}

function buildData(projectRoot) {
  const cards = readSpendCards(projectRoot);
  const epics = groupEpics(cards);
  const totals = cardTotals(cards, epics);
  const { byNode, economy } = buildSpend(projectRoot, cards);
  return {
    generatedAt: new Date().toISOString(),
    totals,
    byNode,
    // Разрез по меткам маршрутов — по тегу движка, в economy.engines[тег].byRoute.
    economy,
    sessionEconomy: readSessionEconomy(projectRoot),
    dialog: readDialog(projectRoot),
    bort: buildBort(projectRoot),
    nodeConfig: readNodeConfig(projectRoot),
    formaCatalog: readFormaCatalog(projectRoot),
    ...buildGraphify(projectRoot),
    subagents: readSubagentsRegistry(projectRoot),
    epics: Object.values(epics).sort((a, b) => a.epic.localeCompare(b.epic, 'ru')),
    chain: buildChain(projectRoot),
    interview: readInterview(projectRoot),
    structure: readStructure(projectRoot),
    settings: { project: readProjectSettings(projectRoot), engine: readEngineSettings(projectRoot) },
    board: buildBoard(projectRoot),
    docs: buildDocs(projectRoot),
    graphsBuilt: graphsBuilt(projectRoot),
  };
}

module.exports = { buildData };

/** CLI: собрать данные и записать в кэш `.forma/dashboard/.cache/data.json`. */
function main() {
  const root = path.resolve(__dirname, '..', '..');
  const outFile = path.join(__dirname, '.cache', 'data.json');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const data = buildData(root);
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Собрано карточек: ${data.totals.cardCount}, эпиков: ${data.totals.epicCount}, токенов по движкам: ${JSON.stringify(data.totals.tokensByEngine)}, заходов с записью: ${data.totals.attemptCount}`);
  console.log(`→ ${path.relative(root, outFile)}`);
}

// Запущен напрямую (не require из serve.js) — собрать и записать в кэш.
if (require.main === module) main();
