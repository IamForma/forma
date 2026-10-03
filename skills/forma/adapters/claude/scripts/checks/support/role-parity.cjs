'use strict';

// Паритет ролей Claude↔Gemini — сведение, не нарушение: роли равны по содержанию, сверяются нормализованным
// текстом. Codex читает роли Claude по ссылке и сверяется проверкой `codex`. Не проверка реестра, а таблица,
// которую печатает сверка.

const fs = require('fs');
const path = require('path');

const CORE_ROLES = ['core', 'intent', 'kit', 'run', 'spec', 'extractor'];
const CLAUDE_ON_DEMAND_DIR = '.claude/agents/on-demand';
const GEMINI_ON_DEMAND_DIR = '.agents/plugins/forma/agents/on-demand';
const RULE = '----------------------------------------------------------------------';

// Пять постоянных ролей (корневые правила больше не пара — они в AGENTS.md, одним файлом) — жёсткий список остаётся:
// это не растущий каталог, новая роль не заводится сама по себе, а решением человека.
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const CORE_FILE_PAIRS = CORE_ROLES.map((role) => ({
  name: `Agent: ${titleCase(role)}`,
  claude: `.claude/agents/${role}.md`,
  gemini: `.agents/plugins/forma/agents/${role}.md`,
  type: 'agent',
}));

const mdFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : []);

// Слой «по требованию» растёт без правки этого скрипта: сканирует оба каталога, сопоставляя по имени файла.
// Файл, существующий только на одной стороне, всё равно попадает в пару — comparePair() увидит его как
// missing_claude/missing_gemini, не пропустит молча.
function scanOnDemandPairs(root) {
  const names = new Set([...mdFiles(path.join(root, CLAUDE_ON_DEMAND_DIR)), ...mdFiles(path.join(root, GEMINI_ON_DEMAND_DIR))]);
  return [...names].sort().map((file) => {
    const display = file.replace(/\.md$/, '').split('-').map(titleCase).join(' ');
    return {
      name: `On-Demand: ${display}`,
      claude: `${CLAUDE_ON_DEMAND_DIR}/${file}`,
      gemini: `${GEMINI_ON_DEMAND_DIR}/${file}`,
      type: 'on-demand',
    };
  });
}

// Что различает роли двух движков и не является расхождением смысла: имена файлов и каталогов, способ вызова
// инструмента, формулировки о среде. Порядок строк — порядок применения.
const AGENT_NORMALIZERS = [
  [/CLAUDE\.md/g, 'ENGINE_RULES.md'],
  [/GEMINI\.md/g, 'ENGINE_RULES.md'],
  [/\.agents\/rules\/gemini-8\.md/g, 'ENGINE_RULES.md'],
  [/gemini-8\.md/g, 'ENGINE_RULES.md'],
  [/\s*\((Gemini Engine|Claude Code)\)/g, ''],
  [/\.claude\/agents\/on-demand\//g, 'AGENTS_DIR/on-demand/'],
  [/\.agents\/plugins\/forma\/agents\/on-demand\//g, 'AGENTS_DIR/on-demand/'],
  [/\.codex\/roles\/on-demand\//g, 'AGENTS_DIR/on-demand/'],
  [/\.codex\/roles\//g, 'AGENTS_DIR/'],
  [/\.codex\/CODEX-8\.md/g, 'ENGINE_RULES.md'],
  [/\.codex\/hooks\/guard-delete\.ps1/g, 'HOOK_GUARD'],
  [/\.claude\/hooks\/guard-delete\.sh/g, 'HOOK_GUARD'],
  [/\.codex\/hooks\/\.delete-unlock/g, 'HOOK_UNLOCK'],
  [/\.claude\/hooks\/\.delete-unlock/g, 'HOOK_UNLOCK'],
  [/\.agents\/skills\//g, 'SKILLS_DIR/'],
  [/\.claude\/skills\//g, 'SKILLS_DIR/'],
  [/\.claude\/agents\//g, 'AGENTS_DIR/'],
  [/\.agents\/plugins\/forma\/agents\//g, 'AGENTS_DIR/'],
  [/\.claude\/skills\//g, 'SKILLS_DIR/'],
  [/\.agents\/skills\//g, 'SKILLS_DIR/'],
  [/\.claude\//g, 'ENGINE_DIR/'],
  [/\.agents\//g, 'ENGINE_DIR/'],
  [/agents\/on-demand\//g, 'AGENTS_DIR/on-demand/'],
  [/\bagents\//g, 'AGENTS_DIR/'],
  [/(\b(intent|spec|kit|run|core)\.md\b)/g, 'AGENTS_DIR/$1'],
  [/AGENTS_DIR\/AGENTS_DIR\//g, 'AGENTS_DIR/'],
  [/skills already available in (Claude Code|the environment)/g, 'skills already available in the environment'],
  [/call `?Skill`?/g, 'call the skill'],
  [/global ones \([^)]+\) and plugin ones \([^)]+\)/g, 'global and plugin ones'],
  [/Bash\((node [^)]+)\)/g, '$1'],
  [/Cost is checked with `simulate_cost`/g, 'Cost is checked'],
  [/the (Antigravity )?plugin marketplace/g, 'the plugin marketplace'],
  [/connected plugin sources( \([^)]+\)|, where the platform provides them)?/g, 'connected plugin sources'],
  [/\(`?new_page`?\s*\+\s*`?take_snapshot`?\)/g, '(`browser_tool`)'],
  [/\(`?browser_subagent`?\)/g, '(`browser_tool`)'],
  [/\(`extractor\.md`(, `omitClaudeMd: true`)?\)/g, '(`extractor.md`)'],
  [/the browser \(`browser_tool`\) is a fallback/g, 'the browser is a fallback'],
  [/## After work \(the "Result" section\)/g, '## After work'],
  [/, read on demand, never entering the cycle cache/g, ''],
  [/The bridge \([^)]+\) stays with you/g, 'The external bridge stays with you'],
  [/The bridge stays with you/g, 'The external bridge stays with you'],
  [/The bridge stays available to you/g, 'The external bridge stays with you'],
  [/The external channel stays available to you/g, 'The external bridge stays with you'],
  [/The bridge \([^)]+\)/g, 'The external bridge'],
  [/the text-to-text bridge gives no live access/g, 'the text-to-text external channel gives no live access'],
  [/internal model \(Agent tool\)/g, 'internal model'],
  [/, local `Bash`/g, ''],
  [/\(needs `execute-php`\/Novamira abilities — you deliberately don't have these, only the `Aura` catalog\)/g, "(needs site access you deliberately don't have)"],
  [/`?Spec`? also keeps the bridge/g, '`Spec` also keeps the external channel'],
  [/set your own tier to (the strongest one|`?strongest`?)( in `?AGENTS_DIR\/kit\.md`?)?/g, 'set your own tier to the strongest one'],
  [/A plugin (from `?claude plugin marketplace`?|connected globally to the environment)/g, 'A plugin from marketplace'],
  [/(A plugin from the marketplace|A globally-connected plugin) goes the same way/g, 'A marketplace/global plugin goes the same way'],
  [/already available (in Claude Code|to the environment)/g, 'already available in the environment'],
  [/call (the skill|it), copy/g, 'call the skill, copy'],
  [/node ((ENGINE_DIR|\.claude)\/scripts|dashboard)\/tally\.cjs( \*)?/g, 'node ENGINE_DIR/scripts/tally.cjs'],
  [/Every bridge call is also an attempt[\s\S]*?never by eye\./g, 'Every external call is an attempt, caller writes line.'],
  [/Every call through the external channel is also an attempt[\s\S]*?never by eye\./g, 'Every external call is an attempt, caller writes line.'],
];

/** Текст к сравнению: без различий переводов строк и концевых пробелов; у ролей — ещё и без различий движка. */
function normalizeText(text, type) {
  let norm = text.replace(/\r\n/g, '\n');
  norm = norm.split('\n').map((l) => l.trimEnd()).join('\n').trim();
  if (type === 'agent' || type === 'on-demand') {
    for (const [re, to] of AGENT_NORMALIZERS) norm = norm.replace(re, to);
    // Игнорируем специфичные поля фронтматтера (model, tools, effort)
    norm = norm.replace(/^---[\s\S]*?---\n/m, '');
  }
  return norm;
}

/** Первые три расходящиеся строки двух текстов для диагностики. */
function lineDiffs(claudeNorm, geminiNorm) {
  const cLines = claudeNorm.split('\n');
  const gLines = geminiNorm.split('\n');
  const max = Math.max(cLines.length, gLines.length);
  const diffs = [];
  for (let i = 0; i < max; i++) {
    if (cLines[i] === gLines[i]) continue;
    diffs.push(`Line ${i + 1}:\n  <Claude>: ${cLines[i] || '[EOF]'}\n  <Gemini>: ${gLines[i] || '[EOF]'}`);
    if (diffs.length >= 3) {
      diffs.push(`... (всего расхождений строк: ${Math.abs(cLines.length - gLines.length) + diffs.length})`);
      break;
    }
  }
  return diffs.join('\n');
}

/** Пара файлов: `{ status: synced|drift|missing_*, diff }`. */
function comparePair(root, pair) {
  const claudePath = path.join(root, pair.claude);
  const geminiPath = path.join(root, pair.gemini);
  const claudeExists = fs.existsSync(claudePath);
  const geminiExists = fs.existsSync(geminiPath);
  if (!claudeExists && !geminiExists) return { status: 'missing_both', diff: 'Both files missing' };
  if (!claudeExists) return { status: 'missing_claude', diff: `Missing ${pair.claude}` };
  if (!geminiExists) return { status: 'missing_gemini', diff: `Missing ${pair.gemini}` };
  const claudeNorm = normalizeText(fs.readFileSync(claudePath, 'utf8'), pair.type);
  const geminiNorm = normalizeText(fs.readFileSync(geminiPath, 'utf8'), pair.type);
  if (claudeNorm === geminiNorm) return { status: 'synced', diff: null };
  return { status: 'drift', diff: lineDiffs(claudeNorm, geminiNorm) };
}

/** Все пары ролей проекта и итог сверки каждой: `[{ pair, res }]`. */
function compareRoles(root) {
  return [...CORE_FILE_PAIRS, ...scanOnDemandPairs(root)].map((pair) => ({ pair, res: comparePair(root, pair) }));
}

/** Заголовок и строки таблицы паритета — в порядке печати. */
function parityTable(results) {
  const lines = [
    'Паритет ролей Claude↔Gemini — сведение, не нарушение (роли не копируются, адаптер Gemini не готов):',
    '| Компонент | Claude файл | Gemini файл | Статус |',
    '|---|---|---|---|',
  ];
  for (const { pair, res } of results) {
    const icon = res.status === 'synced' ? '✓ Паритет' : `✗ Дрейф (${res.status})`;
    lines.push(`| ${pair.name.padEnd(25)} | ${pair.claude.padEnd(35)} | ${pair.gemini.padEnd(45)} | ${icon} |`);
  }
  return lines;
}

/** Строки расхождений по парам с дрейфом (для `--diff`). */
function driftDetails(results) {
  const lines = [];
  for (const { pair, res } of results) {
    if (res.status === 'synced' || !res.diff) continue;
    lines.push(`--- [ ${pair.name} ] ---`, res.diff, RULE + '\n');
  }
  return lines;
}

module.exports = { RULE, compareRoles, comparePair, normalizeText, parityTable, driftDetails };
