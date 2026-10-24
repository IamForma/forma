'use strict';

/**
 * Адаптер MiniMax Code для ядра «Формы»: то, что знает только этот движок.
 * Ядро находит его само — файл `forma-adapter.cjs` в каталоге корня, чьё имя начинается с точки;
 * форма объекта и замена отсутствующего поля — в шапке `.forma/dashboard/lib/engines.cjs`.
 * Соответствие форме проверяет `.minimax/tests/test-minimax-adapter.cjs`.
 *
 * Механика контрактов — `.forma/manual/ru/03-protocol/ENGINE-CONTRACT.md`;
 * что этот движок выполняет конструктивно, а что держит дисциплиной, — мой §8
 * `.minimax/rules/minimax-8.md`.
 */

const fs = require('fs');
const path = require('path');
const economy = require('./scripts/economy.cjs');
const toolUsage = require('./scripts/tool-usage.cjs');
const { readMdCatalog } = require('../.forma/dashboard/lib/forma-roles.cjs');

const ROOT = path.resolve(__dirname, '..');

/** MCP-конфиги моего движка: проектные ездят с репозиторием, пользовательский — с человеком. */
function mcpConfigs(root) {
  return [
    { rel: '.minimax/mcp_config.json', file: path.join(root, '.minimax', 'mcp_config.json'), level: 'проект' },
    { rel: '~/.minimax/mcp.json', file: path.join(process.env.HOME || process.env.USERPROFILE || '', '.minimax', 'mcp.json'), level: 'пользователь' },
  ];
}

/** Имена MCP-серверов без значений (запрет 15: из конфигов — только имена). */
function readMcpNames(root) {
  const out = { project: [], user: [], userProject: [] };
  for (const c of mcpConfigs(root)) {
    let data;
    try {
      if (!fs.existsSync(c.file)) continue;
      data = JSON.parse(fs.readFileSync(c.file, 'utf8'));
    } catch {
      continue;
    }
    const servers = (data && data.mcpServers) || {};
    for (const name of Object.keys(servers)) {
      if (c.level === 'проект') out.project.push(name);
      else out.user.push(name);
    }
  }
  return out;
}

/** Мои настройки: `.minimax/settings.json` (если появятся) — источник хуков и окружения. */
function readSettings(root) {
  const file = path.join(root, '.minimax', 'settings.json');
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Вкладка «Движок»: мои настройки, роли, MCP, скиллы, сверка. */
function engineSettings(root) {
  const st = readSettings(root);
  const agentsDir = path.join(root, '.minimax', 'agents');
  const skillsDir = path.join(root, '.minimax', 'skills');
  const nodes = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name)
    : [];
  const skills = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
    : [];
  return {
    present: !!st,
    env: st && st.env ? Object.keys(st.env) : [],
    hooks: st && st.hooks ? Object.keys(st.hooks) : [],
    nodes,
    skills,
    mcp: readMcpNames(root),
    check: { ran: false, reason: 'сверка ролей этой зоны — node .minimax/scripts/gen-roles.cjs --check' },
    plugins: { ran: false, list: [], reason: 'пакет плагина движка не установлен' },
  };
}

/** Срез ролей для вкладки «Форма»: узлы и каталог Run из моей зоны. */
function formaRoles(root) {
  const cat = readMdCatalog(root, {
    title: 'MiniMax Code',
    rolesDir: '.minimax/agents',
    mcpFiles: mcpConfigs(root),
  });
  cat.plugins = null;
  return cat;
}

module.exports = {
  engine: 'minimax-code',
  id: 'minimax',
  // Метка расхода — та, что движок пишет в строки History и в свой журнал (`minimax:`); `engine` остаётся именем для `check`.
  spendTag: 'minimax',

  // Контракт движка (ENGINE-CONTRACT.md): источники, возможности, таблица узел -> модель, зоны записи.
  sources: {
    rolesDir: '.minimax/agents',
    onDemandRolesDir: '.minimax/agents/on-demand',
    runRolesDir: '.minimax/agents/run',
    scriptsDir: '.minimax/scripts',
    skillsDir: '.minimax/skills',
    testsDir: '.minimax/tests',
    packageManifest: 'miniapps/minimax-engine/.minimax-plugin/plugin.json',
    mcpConfigs: ['.minimax/mcp_config.json'],
  },
  capabilities: { subagents: true, sendMessage: true, hooks: true, mcp: true },
  nodeModels: {
    Intent: { model: 'minimax-m3.1-flash', effort: 'medium' },
    Spec: { model: 'minimax-m3.1-flash', effort: 'medium' },
    Kit: { model: 'minimax-m3.1-flash', effort: 'medium' },
    Run: { model: 'minimax-m3.1-flash', effort: 'medium' },
    Core: { model: 'minimax-m3.1-flash', effort: 'medium' },
  },
  // Зоны записи движка: своя папка, папка пакета плагина (её пишут мои же скрипты
  // `gen-plugin-agents.cjs` и `install-plugin.cjs`) и карточки доски.
  writeZones: ['.minimax', 'miniapps/minimax-engine', '.devtool/features'],

  // Вес инструктажа на шаг вызова и число шагов по кэш-чтению.
  instructionWeight: economy.instructionWeight,
  stepsFromCacheRead: economy.stepsFromCacheRead,

  // Журнал инструментов: разбор объявленных в ролях и записанных хуком.
  toolUsage: {
    source: '.minimax/scripts/tool-usage.cjs',
    readDeclared: toolUsage.readDeclared,
    readLog: toolUsage.readLog,
    baseName: toolUsage.baseName,
  },

  // Расход вызова: каталог стенограмм и разбор одного шага.
  parseUsage: economy.parseUsage,
  transcriptsDir: economy.transcriptsDir,

  // Файлы ролей, §8 и скиллов; скрипты сверки и графа сделанных карточек.
  rolesDir: '.minimax/agents',
  onDemandRolesDir: '.minimax/agents/on-demand',
  engineRulesFile: '.minimax/rules/minimax-8.md',
  skillsDir: '.minimax/skills',
  // Умения, что поставляет шаблон (интервью ядра): по ним вкладка «Проект» отличает ядро от проекта.
  templateSkills: ['forma-grill-with-ui', 'grilling'],
  syncScript: '.minimax/scripts/gen-roles.cjs',

  // Расход диалога: скрипт пишет .forma/dashboard/.cache/session-current.json.
  usageRefresh: [],

  mcpConfigs,
  engineSettings,
  formaRoles,

  // Группа дерева «Структура» и подписи каталогов адаптера.
  //
  // Это единственное место, где движок ОБЪЯВЛЯЕТ свои источники ядру. По конвенции
  // `structure.cjs` группы адаптеров встают между «Движком» и «Проектом», а ядро читает их
  // через `engines.loadAdapters` — то есть тем же путём, каким оно находит саму зону.
  //
  // Графы (`build-kit-graphs.cjs`) сегодня читают `.claude` напрямую и до этих объявлений не
  // добираются: ядро должно перевести сборщик на `engines.collect` (карточка на доске). Пока
  // этого нет, объявление здесь — источник, а не готовая сборка: движок объявляет, ядро
  // собирает, и три движка не конфликтуют, потому что источники не пересекаются.
  structure: {
    key: 'model',
    title: 'Модель · MiniMax Code',
    note: 'адаптер движка MiniMax Code — §8',
    roots: ['.minimax'],
    notes: {
      '.minimax': 'всё, что знает только MiniMax Code',
      '.minimax/agents': 'роли узлов: Intent, Spec, Kit, Run, Core',
      '.minimax/agents/on-demand': 'роли, подгружаемые по случаю',
      '.minimax/agents/run': 'профили Run',
      '.minimax/rules': '§8 — архитектура движка в MiniMax Code',
      '.minimax/scripts': 'скрипты адаптера: журнал, проба, генератор ролей',
      '.minimax/skills': 'арсенал скиллов',
      '.minimax/.ledger': 'журнал вызовов — источник строк расхода',
      '.minimax/.state': 'факты о возможностях движка (проба) и свидетель наблюдений',
      '.minimax/.transcripts': 'нормированные стенограммы — пол окна и разрезы по моделям',
      '.minimax/tests': 'тест соответствия адаптера',
    },
    // Что движок отдаёт сборщику графов: список путей, а не готовый граф. Пусто — источников нет.
    sources: {
      rolesDir: '.minimax/agents',
      onDemandRolesDir: '.minimax/agents/on-demand',
      runRolesDir: '.minimax/agents/run',
      scriptsDir: '.minimax/scripts',
      skillsDir: '.minimax/skills',
      testsDir: '.minimax/tests',
      rulesFile: '.minimax/rules/minimax-8.md',
      packageManifest: 'miniapps/minimax-engine/.minimax-plugin/plugin.json',
      adapter: '.minimax/forma-adapter.cjs',
      mcpConfig: '.minimax/mcp_config.json',
    },
  },
};
