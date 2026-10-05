'use strict';

/**
 * Адаптер Claude Code для ядра «Формы»: то, что знает только этот движок.
 * Ядро находит его само — файл `forma-adapter.cjs` в каталоге корня, чьё имя начинается с точки;
 * форма объекта и замена отсутствующего поля — в шапке `.forma/dashboard/lib/engines.cjs`.
 * Соответствие форме проверяет `.claude/scripts/forma-adapter.test.cjs`.
 */

const instruction = require('./scripts/instruction-weight.cjs');
const toolUsage = require('./scripts/tool-usage.cjs');
const { claudeUsage } = require('./scripts/claude-economy.cjs');
const view = require('./scripts/dashboard-view.cjs');
const { readMdCatalog } = require('../.forma/dashboard/lib/forma-roles.cjs');

/** Срез ролей для вкладки «Форма»: узлы и каталог Run из .claude/agents, плагины — данные движка. */
function formaRoles(root) {
  const cat = readMdCatalog(root, {
    title: 'Claude Code',
    rolesDir: '.claude/agents',
    mcpFiles: view.mcpConfigs(root),
  });
  const p = view.engineSettings(root).plugins;
  cat.plugins = !p || !p.ran
    ? { ran: false, project: [], user: [], reason: (p && p.reason) || null }
    : { ran: true, project: p.list.filter((x) => x.scope === 'project'), user: p.list.filter((x) => x.scope !== 'project') };
  return cat;
}

module.exports = {
  engine: 'claude-code',

  // Вес инструкций на шаг вызова и число шагов по кэш-чтению.
  instructionWeight: instruction.instructionWeight,
  stepsFromCacheRead: instruction.stepsFromCacheRead,

  // Журнал инструментов: разбор объявленных в ролях и записанных хуком.
  toolUsage: {
    source: '.claude/scripts/tool-usage.cjs',
    readDeclared: toolUsage.readDeclared,
    readLog: toolUsage.readLog,
    baseName: toolUsage.baseName,
  },

  // Расход вызова: каталог стенограмм и разбор одного шага `message.usage`.
  parseUsage: claudeUsage,
  transcriptsDir: view.transcriptsDir,

  // Файлы ролей, §8 и скиллов; скрипты сверки и графа сделанных карточек.
  rolesDir: '.claude/agents',
  onDemandRolesDir: '.claude/agents/on-demand',
  engineRulesFile: '.claude/rules/claude-8.md',
  skillsDir: '.claude/skills',
  // Умения, что поставляет шаблон (адаптер Claude + интервью ядра): по ним вкладка «Проект» отличает ядро от проекта.
  // Список едет с адаптером — в установленном проекте клона .forma/protocol/ нет; сверка с шаблоном — forma-adapter.test.cjs.
  templateSkills: ['excalidraw-diagrams', 'forma-grill-with-ui', 'graph-build', 'graphify', 'grilling', 'project-knowledge', 'skill-authoring'],
  syncScript: '.claude/scripts/sync-engines.cjs',
  doneCardsGraphScript: '.claude/scripts/build-done-cards-graph.cjs',

  // Расход диалога: скрипт пишет .forma/dashboard/.cache/session-current.json.
  usageRefresh: [
    { script: '.claude/scripts/session-economy.cjs', args: ['--session', 'current'], cache: 'session-current.json' },
  ],

  mcpConfigs: view.mcpConfigs,
  engineSettings: view.engineSettings,
  formaRoles,

  // Группа дерева «Структура» и подписи каталогов адаптера.
  structure: {
    key: 'model',
    title: 'Модель · Claude Code',
    note: 'адаптер движка Claude Code — §8',
    roots: ['.claude'],
    notes: {
      '.claude': 'всё, что знает только Claude Code',
      '.claude/agents': 'роли узлов: Intent, Spec, Kit, Run, Core',
      '.claude/agents/on-demand': 'роли, подгружаемые по случаю',
      '.claude/rules': '§8 — архитектура движка в Claude Code',
      '.claude/hooks': 'хуки: старт сессии, защита удаления, проверка карточек',
      '.claude/scripts': 'скрипты адаптера: экономика, графы, сайт',
      '.claude/skills': 'арсенал скиллов',
      '.claude/settings.json': 'хуки, права, окружение',
      '.forma/skills': 'интервью-скиллы ядра, доставляются в .claude/skills',
    },
  },
};
