// Манифест схемы движка: блоки, типы связей, правила «файл -> блок». Только данные, без обхода диска.
// Ключи блоков и типов связей — английские (подписи RU/EN отдельно). Файл принадлежит ровно одному блоку:
// правила идут по порядку, побеждает первое совпадение. Файл без правила попадает в «неразобранное».
// Связи и состав здесь не рисуются — их собирает schema.cjs из реальных файлов.
'use strict';

const LINK_TYPES = [
  { key: 'reads', ru: 'читает', en: 'reads' },
  { key: 'writes', ru: 'пишет', en: 'writes' },
  { key: 'calls', ru: 'вызывает', en: 'calls' },
  { key: 'registers', ru: 'регистрирует', en: 'registers' },
  { key: 'spawns', ru: 'порождает', en: 'spawns' },
];

const BLOCKS = [
  { key: 'rules', ru: 'Правила', en: 'Rules',
    descRu: 'Закон, раздел движка, профиль проекта и пороги', descEn: 'The law, the engine section, the project profile and thresholds' },
  { key: 'nodes', ru: 'Узлы и маршрут', en: 'Nodes and route',
    descRu: 'Роли Intent, Spec, Kit, Run, Core, профили Run, Plumb', descEn: 'Roles Intent, Spec, Kit, Run, Core, Run profiles, Plumb' },
  { key: 'board', ru: 'Доска', en: 'Board',
    descRu: 'Карточки, переходы, проверки доски', descEn: 'Cards, moves, board checks' },
  { key: 'economy', ru: 'Экономика', en: 'Economy',
    descRu: 'Журнал вызовов, строки расхода, учёт инструментов', descEn: 'Call ledger, spend lines, tool log' },
  { key: 'checks', ru: 'Скрипты и проверки', en: 'Scripts and checks',
    descRu: 'sync-engines, checks/, вес инструкций', descEn: 'sync-engines, checks/, instruction weight' },
  { key: 'hooks', ru: 'Хуки и разрешения', en: 'Hooks and permissions',
    descRu: 'settings.json, хуки, уровни доступа, защита от удаления', descEn: 'settings.json, hooks, access levels, delete-guard' },
  { key: 'knowledge', ru: 'Знания и графы', en: 'Knowledge and graphs',
    descRu: 'Умения, руководство, графы, ресурсы', descEn: 'Skills, manual, graphs, resources' },
  { key: 'dashboard', ru: 'Дашборд', en: 'Dashboard',
    descRu: 'Сбор данных, страница, локали', descEn: 'Data collection, page, locales' },
  { key: 'protocol', ru: 'Протокол и релиз', en: 'Protocol and release',
    descRu: 'Клон протокола, перенос, адаптеры движков, расширения, локализация, проверка установки',
    descEn: 'Protocol clone, transfer, engine adapters, extensions, localization, install verification' },
  { key: 'outputs', ru: 'Выходы', en: 'Outputs',
    descRu: 'Что движок производит: журнал, живые записи, инструменты продукта', descEn: 'What the engine produces: journal, living records, product tools' },
];

// Порядок важен: сверху частные правила, снизу общие. glob: ** — любая глубина, * — внутри имени.
const RULES = [
  // правила
  { block: 'rules', glob: 'AGENTS.md', does: 'Law, sections 1-7' },
  { block: 'rules', glob: '.claude/rules/**' },
  { block: 'rules', glob: '.agents/rules/**' },
  { block: 'rules', glob: '.codex/CODEX-8.md' },
  { block: 'rules', glob: 'project/config/**' },
  { block: 'rules', glob: '.forma/templates/**' },
  // хуки и разрешения (до общих правил по .claude/scripts и .forma/rules)
  { block: 'hooks', glob: '.claude/settings.json', does: 'Claude Code settings: permissions and hook registration' },
  { block: 'hooks', glob: '.claude/hooks/**' },
  { block: 'hooks', glob: '.claude/permission-levels.json' },
  { block: 'hooks', glob: '.claude/scripts/permissions-level*' },
  { block: 'hooks', glob: '.forma/rules/**' },
  { block: 'hooks', glob: '.agents/hooks/**' },
  { block: 'hooks', glob: '.agents/hooks.json' },
  { block: 'hooks', glob: '.codex/hooks/**' },
  { block: 'hooks', glob: '.codex/hooks.json' },
  { block: 'hooks', glob: '.mcp.json' },
  // узлы и маршрут
  { block: 'nodes', glob: '.claude/agents/**' },
  { block: 'nodes', glob: '.forma/plumb/**' },
  { block: 'nodes', glob: '.claude/scripts/plumb-*' },
  { block: 'nodes', glob: '.claude/scripts/external-model-bridge*' },
  { block: 'nodes', glob: '.codex/agents/**' },
  { block: 'nodes', glob: '.codex/roles/**' },
  // доска
  { block: 'board', glob: '.forma/board/**' },
  { block: 'board', glob: '.claude/scripts/card-assets-sweep*' },
  { block: 'board', glob: '.claude/scripts/cycle-status*' },
  // экономика
  { block: 'economy', glob: '.claude/scripts/claude-economy*' },
  { block: 'economy', glob: '.claude/scripts/session-economy*' },
  { block: 'economy', glob: '.claude/scripts/card-session-spend*' },
  { block: 'economy', glob: '.claude/scripts/ledger-recorder*' },
  { block: 'economy', glob: '.claude/scripts/tool-usage*' },
  { block: 'economy', glob: '.forma/dashboard/economy*' },
  { block: 'economy', glob: '.forma/dashboard/tally.cjs' },
  { block: 'economy', glob: '.forma/dashboard/spend-line.cjs' },
  { block: 'economy', glob: '.forma/dashboard/tool-usage.log' },
  // проверки
  { block: 'checks', glob: '.claude/scripts/sync-engines*' },
  { block: 'checks', glob: '.claude/scripts/checks/**' },
  { block: 'checks', glob: '.claude/scripts/instruction-weight*' },
  { block: 'checks', glob: '.claude/scripts/test-ledger-parity*' },
  { block: 'checks', glob: '.forma/living/checks.json' },
  { block: 'checks', glob: '.forma/dashboard/checks/**' },
  // знания и графы
  { block: 'knowledge', glob: '.claude/scripts/build-kit-graphs*' },
  { block: 'knowledge', glob: '.claude/scripts/build-engine-graph*' },
  { block: 'knowledge', glob: '.claude/scripts/build-graph-html*' },
  { block: 'knowledge', glob: '.claude/scripts/build-tendons*' },
  { block: 'knowledge', glob: '.claude/scripts/graph-query*' },
  { block: 'knowledge', glob: '.claude/scripts/auto-graphs*' },
  { block: 'knowledge', glob: '.claude/scripts/resources*' },
  { block: 'knowledge', glob: '.claude/scripts/build-core-html-payload*' },
  { block: 'knowledge', glob: '.claude/skills/graph-build/**' },
  { block: 'knowledge', glob: '.claude/skills/graphify/**' },
  { block: 'knowledge', glob: '.claude/skills/human-register/**' },
  { block: 'knowledge', glob: '.claude/skills/skill-authoring/**' },
  { block: 'knowledge', glob: '.claude/skills/grilling/**' },
  { block: 'knowledge', glob: '.claude/skills/forma-grill-with-ui/**' },
  { block: 'knowledge', glob: '.claude/skills/project-knowledge/**' },
  { block: 'knowledge', glob: '.claude/skills/engine-switch/**' },
  { block: 'knowledge', glob: '.forma/skills/**' },
  { block: 'knowledge', glob: '.forma/manual/**' },
  { block: 'knowledge', glob: '.forma/dashboard/graphify*' },
  // дашборд
  { block: 'dashboard', glob: '.forma/dashboard/**' },
  { block: 'dashboard', glob: '.claude/scripts/dashboard-view*' },
  // протокол и релиз
  { block: 'protocol', glob: '.forma/protocol/**' },
  { block: 'protocol', glob: '.forma/verify/**' },
  { block: 'protocol', glob: '.forma/i18n/**' },
  { block: 'protocol', glob: '.forma/extensions/**' },
  { block: 'protocol', glob: '.forma/engines.json' },
  { block: 'protocol', glob: '.forma/extensions-state.json' },
  { block: 'protocol', glob: '.forma/install-manifest.json' },
  { block: 'protocol', glob: '.claude/forma-adapter.cjs' },
  { block: 'protocol', glob: '.claude/verify-profile.cjs' },
  { block: 'protocol', glob: '.claude/project-layer.txt' },
  { block: 'protocol', glob: '.claude/scripts/engine-switch*' },
  { block: 'protocol', glob: '.claude/scripts/forma-adapter*' },
  { block: 'protocol', glob: '.agents/forma-adapter.cjs' },
  { block: 'protocol', glob: '.agents/verify-profile.cjs' },
  { block: 'protocol', glob: '.agents/mcp_config.json' },
  { block: 'protocol', glob: '.agents/scripts/**' },
  { block: 'protocol', glob: '.agents/tests/**' },
  { block: 'protocol', glob: '.codex/forma-adapter.cjs' },
  { block: 'protocol', glob: '.codex/scripts/**' },
  { block: 'protocol', glob: '.codex/tests/**' },
  { block: 'protocol', glob: '.codex/*.md' },
  { block: 'protocol', glob: '.codex/config.toml' },
  { block: 'protocol', glob: '.codex/generated-skill-mirror.json' },
  // выходы
  { block: 'outputs', glob: '.forma/living/**' },
  { block: 'outputs', glob: 'project/ops/**' },
  { block: 'outputs', glob: '.claude/skills/**', does: 'Product skill of the project' },
  { block: 'outputs', glob: '.claude/scripts/**', does: 'Product-work script of the project (site, translation, pages, images)' },
];

// Корни обхода: что считается файлами схемы. Каталоги, не вошедшие сюда (.devtool, project/cards, графы) — выходы
// движка, а не его состав; куда вести связи на них — в AREAS.
const ROOTS = [
  'AGENTS.md', '.mcp.json',
  '.claude/agents', '.claude/rules', '.claude/scripts', '.claude/hooks', '.claude/skills',
  '.claude/settings.json', '.claude/permission-levels.json', '.claude/forma-adapter.cjs', '.claude/verify-profile.cjs', '.claude/project-layer.txt',
  '.agents/rules', '.agents/hooks', '.agents/hooks.json', '.agents/forma-adapter.cjs', '.agents/verify-profile.cjs', '.agents/mcp_config.json', '.agents/scripts', '.agents/tests',
  '.codex',
  '.forma/board', '.forma/dashboard', '.forma/plumb', '.forma/manual', '.forma/i18n', '.forma/extensions', '.forma/rules',
  '.forma/verify', '.forma/skills', '.forma/templates', '.forma/living', '.forma/engines.json', '.forma/extensions-state.json',
  '.forma/install-manifest.json',
  '.forma/protocol',
  'project/config', 'project/ops',
];

// Не файлы схемы: служебное и тяжёлое (в клоне протокола — только скрипты и корень, остальное одной строкой в areas).
const SKIP_DIRS = ['node_modules', '.git', '.cache', '__pycache__', 'graphs', 'temp', '.ledger', 'agents-plugin'];
const SKIP_GLOBS = [
  '.forma/protocol/skills/**', '.forma/protocol/templates/**', '.forma/protocol/test/**', '.forma/protocol/docs/**',
  '.forma/protocol/assets/**', '.forma/protocol/.github/**',
  '.claude/skills/*/references/**', '.claude/skills/*/assets/**', '.claude/skills/*/scripts/**',
  '.forma/dashboard/*.log', '.forma/living/dictionary/**', '.forma/living/migrations/**',
  '.agents/plugins/**', '.agents/skills/**',
];

// Куда ведёт связь, если цель — не файл схемы, а каталог/файл вне состава: префикс -> блок.
const AREAS = [
  { prefix: '.devtool/features', block: 'board' },
  { prefix: '.devtool', block: 'board' },
  { prefix: '.claude/.ledger', block: 'economy' },
  { prefix: '.agents/.ledger', block: 'economy' },
  { prefix: '.forma/living/graphs', block: 'knowledge' },
  { prefix: 'project/cards', block: 'outputs' },
  { prefix: 'project/goals', block: 'outputs' },
  { prefix: 'project/experience', block: 'knowledge' },
  { prefix: 'project/VARS', block: 'rules' },
  { prefix: 'project/brief', block: 'outputs' },
  { prefix: '.env', block: 'rules' },
];

// Входы, которые вызывает не файл, а сам движок или человек: кто вызывает — из этой записи, а не из связи.
const ENTRYPOINTS = [
  { glob: 'AGENTS.md', ru: 'Читает движок при старте', en: 'Read natively by the engine at start' },
  { glob: '.claude/rules/**', ru: 'Читает Claude Code при старте', en: 'Read by Claude Code at start' },
  { glob: '.claude/agents/*.md', ru: 'Агент: вызывает главная сессия через Agent', en: 'Agent: invoked by the main session via Agent' },
  { glob: '.claude/agents/run/*.md', ru: 'Профиль Run: выбирает Kit', en: 'Run profile: picked by Kit' },
  { glob: '.claude/agents/on-demand/*.md', ru: 'Читает узел по событию', en: 'Read by a node at the event' },
  { glob: '.claude/skills/*/SKILL.md', ru: 'Умение: вызывает узел или человек', en: 'Skill: invoked by a node or the human' },
  { glob: '**/*.test.cjs', ru: 'node --test', en: 'node --test' },
  { glob: '**/test-*.cjs', ru: 'Запускает проверка или node --test', en: 'Run by a check or node --test' },
  { glob: '.forma/dashboard/web/**', ru: 'Страница дашборда в браузере', en: 'Dashboard page in the browser' },
  { glob: '.forma/dashboard/index.html', ru: 'Страница дашборда в браузере', en: 'Dashboard page in the browser' },
  { glob: '.forma/manual/**', ru: 'Читает человек', en: 'Read by the human' },
];

module.exports = { LINK_TYPES, BLOCKS, RULES, ROOTS, SKIP_DIRS, SKIP_GLOBS, AREAS, ENTRYPOINTS };
