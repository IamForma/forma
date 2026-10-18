'use strict';

/**
 * Конструкция корневых правил: AGENTS.md — единственный источник §1–7, файлы §8 движков подаются отдельно
 * и не держат своей копии правил. Сверять два текста больше нечего — проверяется именно то, что текст один.
 */

const fs = require('fs');
const path = require('path');

const SECTIONS = ['## 1.', '## 2.', '## 3.', '## 4.', '## 5.', '## 6.', '## 7.'];
const BINDINGS = [
  [/\.claude\/agents\//, 'путь .claude/agents/'],
  [/\.agents\/plugins\//, 'путь .agents/plugins/'],
  [/subagent_tokens|duration_ms|cache_read_input_tokens|agent_id/, 'поля расхода конкретного движка'],
];
const CLAUDE_RULES_REL = '.claude/rules/claude-8.md';
const IMPORT_RE = /^@AGENTS\.md\s*$/m;

const exists = (root, rel) => fs.existsSync(path.join(root, rel));

/** AGENTS.md: есть, разделы §1–7 на месте, §8 и путей/полей конкретного движка в нём нет. */
function lawProblems(agents) {
  const problems = [];
  for (const sec of SECTIONS) if (!agents.includes(sec)) problems.push(`AGENTS.md: нет раздела ${sec}`);
  if (/## 8\./.test(agents)) problems.push('AGENTS.md содержит §8 — архитектура движка туда не входит');
  for (const [re, what] of BINDINGS) {
    if (re.test(agents)) problems.push(`AGENTS.md привязан к движку: ${what} — этому место в §8 своего файла`);
  }
  return problems;
}

/**
 * Файлы §8, которые надо проверять. У Claude Code два законных устройства: «корневой» — CLAUDE.md со строкой @AGENTS.md
 * (работает везде, включая среды без нативного чтения), и «каталог правил» — CLAUDE.md в корне нет, движок сам читает
 * AGENTS.md (§1–7) и .claude/rules/claude-8.md (§8); импорта в файле §8 тогда быть не должно — его никто не обрабатывает.
 * Обёртка Gemini — только если адаптер Gemini установлен (.agents/ есть): проект на одном Claude — законная установка.
 */
function engineFiles(root, claudeNativeMode) {
  return [
    claudeNativeMode
      ? { name: 'Claude Code', path: CLAUDE_RULES_REL, needsImport: false }
      : { name: 'Claude Code', path: 'CLAUDE.md', needsImport: true },
    ...(exists(root, '.agents') ? [{ name: 'Gemini (Antigravity)', path: '.agents/rules/gemini-8.md', needsImport: true }] : []),
  ];
}

/** Файл §8 одного движка: импорт @AGENTS.md там, где его читают, §8 «Engine architecture», нет своей копии §1–7. */
function engineFileProblems(root, item) {
  const target = item.path;
  if (!exists(root, target)) return [`${item.path} отсутствует`];
  const problems = [];
  const txt = fs.readFileSync(path.join(root, target), 'utf8');
  const head = txt.split('\n').slice(0, 3).join('\n');
  if (item.needsImport && !IMPORT_RE.test(head)) {
    problems.push(`${target}: нет импорта @AGENTS.md в первых строках — узлы не получат §1–7`);
  }
  if (!item.needsImport && IMPORT_RE.test(head)) {
    problems.push(`${target}: строка @AGENTS.md бесполезна — файл подаётся хуком, импорт из него не работает`);
  }
  if (!/#\s*8\.\s*Engine architecture/.test(txt)) problems.push(`${target}: нет §8 «Engine architecture»`);
  if (/## 2\. Route/.test(txt) || /## 5\. Prohibitions/.test(txt)) {
    problems.push(`${target}: держит свою копию §1–7 — два источника правды у одной схемы`);
  }
  return problems;
}

function run({ root }) {
  if (!exists(root, 'AGENTS.md')) return ['AGENTS.md отсутствует — общего закона протокола нет ни для одного движка'];
  const problems = lawProblems(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'));
  // Корневой GEMINI.md упразднён: §8 Antigravity живёт в .agents/rules/gemini-8.md. Его возврат — рассинхрон, а не запасной путь.
  if (exists(root, 'GEMINI.md')) problems.push('GEMINI.md вернулся в корень — §8 Antigravity живёт в .agents/rules/gemini-8.md');
  // Корневой CLAUDE.md упразднён: специфика движка — только в §8-файле.
  const claudeNativeMode = !exists(root, 'CLAUDE.md');
  if (!claudeNativeMode) problems.push('CLAUDE.md в корне — упразднён; §8 Claude Code живёт в .claude/rules/claude-8.md');
  for (const item of engineFiles(root, claudeNativeMode)) problems.push(...engineFileProblems(root, item));
  return problems;
}

module.exports = { id: 'root-rules', since: null, run };
