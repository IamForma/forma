'use strict';

/**
 * Генератор субагентов пакета движка: роли зоны → `agents/<роль>.md` пакета.
 *
 * Плагин отдаёт свои роли рантайму как субагентов, и рантайм читает их из пакета, а не из
 * зоны. Чтобы не было второй копии, файлы пакета — ПРОИЗВОДНЫЕ: тело роли переносится
 * дословно, а шапка переписывается под контракт плагина (нативные имена инструментов,
 * без алиасов и без `task` — субагент плагина не может делегировать дальше).
 *
 * Два переноса, без которых субагент не работает:
 *   1. инструменты — `Bash(node … *)` это не имя инструмента, а шаблон прав; имя — `bash`;
 *   2. пути — субагент работает с корнем проекта, а роль говорит «относительно зоны»:
 *      `agents/on-demand/…` значит `.minimax/agents/on-demand/…`.
 *
 * Запуск: node .minimax/scripts/gen-plugin-agents.cjs [--check]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, '.minimax', 'agents');
const PKG_DIR = path.join(ROOT, 'miniapps', 'minimax-engine');
const OUT_DIR = path.join(PKG_DIR, 'agents');

/** Роли зоны, которые становятся субагентами. `intent` — главная сессия, не субагент. */
const ROLES = ['spec', 'kit', 'run', 'core', 'extractor', 'plumb-haiku', 'asset-describer-haiku'];

/** Имена инструментов: роль (Claude) → нативное имя рантайма. */
const NATIVE = {
  Read: 'read', Write: 'write', Edit: 'edit', Grep: 'grep', Glob: 'glob',
  Bash: 'bash', WebFetch: 'web_fetch', WebSearch: 'web_search',
  TodoWrite: 'todowrite', AskUserQuestion: 'ask_user',
};

/** Имена, которые рантайм не примет: алиасы, `task` (субагент не делегирует), MCP-серверы. */
const DROPPED = new Set(['Task', 'SendMessage', 'KillShell', 'TaskOutput', 'Skill', 'Agent']);

/**
 * Роли, которым инструменты не ограничиваются: `tools` — это allowlist, и список сузил бы
 * `Kit` до шести инструментов, а он работает с MCP-серверами и браузером. Наследование
 * (поле `tools` не задано) даёт субагенту весь набор родительской сессии.
 */
const INHERIT_TOOLS = new Set(['kit']);

/** Когда главной сессии стоит звать этого узла — подсказка к описанию роли. */
const DELEGATE = {
  spec: 'Зови, когда задачу надо нарезать на карточки: одна карточка — одна квалификация.',
  kit: 'Зови, когда задаче нужно снаряжение: роль, доступ, скрипты, профили Run.',
  run: 'Зови, когда задача снаряжена и её надо исполнить ровно по назначенному.',
  core: 'Зови, когда круг закрыт и нужен вердикт: достигнут ли конец-образ, и кто в нём виноват.',
  extractor: 'Зови, когда нужно вытащить из файлов ровно запрошенное, без решений.',
  'plumb-haiku': 'Зови, когда нужно измерить, какая роль подходит под очищенную задачу.',
  'asset-describer-haiku': 'Зови, когда нужно описать подготовленные изображения по манифесту.',
};

const DISPLAY = {
  spec: 'Spec — нарезка задачи',
  kit: 'Kit — снаряжение и роль',
  run: 'Run — исполнение',
  core: 'Core — вердикт круга',
  extractor: 'Extractor — извлечение',
  'plumb-haiku': 'Plumb — измерение (встроенная малая модель)',
  'asset-describer-haiku': 'Asset describer — описание изображений',
};

/**
 * Перенос путей из «относительно зоны» в «относительно корня проекта» — рабочий каталог
 * субагента. Чтение общих скриптов `.claude/scripts/*` не переносится: это названная
 * зависимость (§8 зоны), файлы существуют в проекте как есть.
 */
const PATH_RULES = [
  [/\.claude\/agents/g, '.minimax/agents'],
  [/\.claude\/rules/g, '.minimax/rules'],
  [/(?<![\w./~-])agents\/on-demand\//g, '.minimax/agents/on-demand/'],
  [/(?<![\w./~-])agents\/run\//g, '.minimax/agents/run/'],
  [/(?<![\w./~-])agents\//g, '.minimax/agents/'],
  [/(?<![\w./~-])on-demand\//g, '.minimax/agents/on-demand/'],
  [/(?<![\w./~-])rules\/minimax-8\.md/g, '.minimax/rules/minimax-8.md'],
  [/(?<![\w./~-])skills\//g, '.minimax/skills/'],
];

function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return { fm: '', body: text };
  return { fm: m[1], body: text.slice(m[0].length) };
}

function field(fm, name) {
  const m = fm.match(new RegExp('^' + name + ':\\s*(.*)$', 'm'));
  return m ? m[1].trim() : '';
}

/** Инструменты роли → нативные имена: `Bash(node … *)` — это `bash`, а не отдельное имя. */
function nativeTools(tools) {
  const out = [];
  for (const raw of String(tools).split(',')) {
    let name = raw.trim();
    if (!name) continue;
    const paren = name.indexOf('(');
    if (paren > 0) name = name.slice(0, paren).trim();
    if (DROPPED.has(name)) continue;
    if (name.startsWith('mcp__')) continue;
    const mapped = NATIVE[name];
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

/** Тело роли из зоны — с путями, приведёнными к корню проекта. */
function adaptBody(body) {
  let out = body;
  for (const [re, to] of PATH_RULES) out = out.replace(re, to);
  return out;
}

function build(role) {
  const src = path.join(SRC_DIR, role + '.md');
  const text = fs.readFileSync(src, 'utf8');
  const { fm, body } = splitFrontmatter(text);
  const zoneDescription = field(fm, 'description') || 'Узел протокола «Формы»: ' + role;
  const hint = DELEGATE[role] ? ' ' + DELEGATE[role] : '';
  const head = ['---', `name: ${role}`, `description: ${zoneDescription}${hint}`];
  if (!INHERIT_TOOLS.has(role)) {
    const tools = nativeTools(field(fm, 'tools'));
    if (tools.length) head.push('tools: [' + tools.join(', ') + ']');
  }
  head.push('x-mavis:', `  displayName: ${DISPLAY[role] || role}`);
  head.push('---', '');
  return head.join('\n') + adaptBody(body);
}

function main() {
  const check = process.argv.includes('--check');
  const diffs = [];
  for (const role of ROLES) {
    const want = build(role);
    const out = path.join(OUT_DIR, role + '.md');
    if (check) {
      const have = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
      if (have !== want) diffs.push(role);
      continue;
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(out, want, 'utf8');
  }
  if (check) {
    if (diffs.length) {
      console.log('субагентов, чьё тело разошлось с ролью зоны: ' + diffs.join(', '));
      process.exit(1);
    }
    console.log(`все ${ROLES.length} субагентов совпадают с ролями зоны`);
    return;
  }
  console.log(`записано субагентов: ${ROLES.length} → ${path.relative(ROOT, OUT_DIR).replace(/\\/g, '/')}`);
}

if (require.main === module) main();

module.exports = { build, nativeTools, adaptBody, ROLES, OUT_DIR, PKG_DIR, INHERIT_TOOLS };
