'use strict';

/**
 * Конструкция корневых правил: AGENTS.md — единственный источник §1–7, файлы §8 движков подаются отдельно
 * и не держат своей копии правил. Сверять два текста больше нечего — проверяется именно то, что текст один.
 */

const fs = require('fs');
const path = require('path');

const SECTIONS = ['## 1.', '## 2.', '## 3.', '## 4.', '## 5.', '## 6.', '## 7.'];
const FIELD_BINDING = [/subagent_tokens|duration_ms|cache_read_input_tokens|agent_id/, 'поля расхода конкретного движка'];
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Привязки к движку в AGENTS.md: каталог ролей каждого адаптера проекта + поля расхода. */
function bindings(root) {
  const E = require('../../../.forma/dashboard/lib/engines.cjs');
  const dirs = new Set(E.loadAdapters(root).map((a) => E.sourcesOf(a).rolesDir).filter(Boolean));
  return [...[...dirs].map((d) => [new RegExp(esc(d) + '/'), `путь ${d}/`]), FIELD_BINDING];
}
const CLAUDE_RULES_REL = '.claude/rules/claude-8.md';
const IMPORT_RE = /^@AGENTS\.md\s*$/m;

const exists = (root, rel) => fs.existsSync(path.join(root, rel));

/** AGENTS.md: есть, разделы §1–7 на месте, §8 и путей/полей конкретного движка в нём нет. */
function lawProblems(agents, root) {
  const problems = [];
  for (const sec of SECTIONS) if (!agents.includes(sec)) problems.push(`AGENTS.md: нет раздела ${sec}`);
  if (/## 8\./.test(agents)) problems.push('AGENTS.md содержит §8 — архитектура движка туда не входит');
  for (const [re, what] of bindings(root)) {
    if (re.test(agents)) problems.push(`AGENTS.md привязан к движку: ${what} — этому место в §8 своего файла`);
  }
  return problems;
}

/**
 * Файлы §8, которые надо проверять. У Claude Code два законных устройства: «корневой» — CLAUDE.md со строкой @AGENTS.md
 * (работает везде, включая среды без нативного чтения), и «каталог правил» — CLAUDE.md в корне нет, движок сам читает
 * AGENTS.md (§1–7) и .claude/rules/claude-8.md (§8); импорта в файле §8 тогда быть не должно — его никто не обрабатывает.
 * Файлы §8 остальных движков — по адаптерам проекта (`engineRulesFile`): проект на одном Claude — законная установка.
 * Импорт @AGENTS.md у них не требуется и не запрещается: способ чтения закона — дело движка.
 */
function engineFiles(root, claudeNativeMode) {
  return [
    claudeNativeMode
      ? { name: 'Claude Code', path: CLAUDE_RULES_REL, needsImport: false }
      : { name: 'Claude Code', path: 'CLAUDE.md', needsImport: true },
    ...require('../../../.forma/dashboard/lib/engines.cjs').loadAdapters(root)
      .filter((a) => typeof a.engineRulesFile === 'string' && a.engineRulesFile !== CLAUDE_RULES_REL)
      .map((a) => ({ name: a.engine || a.dir, path: a.engineRulesFile, needsImport: null })),
  ];
}

/** Файл §8 одного движка: импорт @AGENTS.md там, где его читают, §8 «Engine architecture», нет своей копии §1–7. */
function engineFileProblems(root, item) {
  const target = item.path;
  if (!exists(root, target)) return [`${item.path} отсутствует`];
  const problems = [];
  const txt = fs.readFileSync(path.join(root, target), 'utf8');
  const head = txt.split('\n').slice(0, 3).join('\n');
  if (item.needsImport === true && !IMPORT_RE.test(head)) {
    problems.push(`${target}: нет импорта @AGENTS.md в первых строках — узлы не получат §1–7`);
  }
  if (item.needsImport === false && IMPORT_RE.test(head)) {
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
  const problems = lawProblems(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), root);
  // Корневые обёртки движков (GEMINI.md) упразднены: §8 живёт в файле правил адаптера. Возврат — рассинхрон, а не запасной путь.
  if (exists(root, 'GEMINI.md')) problems.push('GEMINI.md вернулся в корень — §8 живёт в файле правил адаптера движка (engineRulesFile)');
  // Корневой CLAUDE.md упразднён: специфика движка — только в §8-файле.
  const claudeNativeMode = !exists(root, 'CLAUDE.md');
  if (!claudeNativeMode) problems.push('CLAUDE.md в корне — упразднён; §8 Claude Code живёт в .claude/rules/claude-8.md');
  for (const item of engineFiles(root, claudeNativeMode)) problems.push(...engineFileProblems(root, item));
  return problems;
}

module.exports = { id: 'root-rules', since: null, run };
