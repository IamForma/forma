'use strict';

// Адаптер движка найден по файлу §8; готов — если несёт тест соответствия контракту экономики (ECONOMY.md).
// Не готов — сведение (строка в `ctx.info`, готовая к печати), не нарушение.

const fs = require('fs');
const path = require('path');
const { runTestFile } = require('../../../.forma/dashboard/lib/checks.cjs');

const ADAPTERS = [
  { name: 'Claude Code', eight: '.claude/rules/claude-8.md', test: '.claude/scripts/claude-economy.test.cjs' },
  { name: 'Codex', eight: '.codex/CODEX-8.md', test: '.codex/tests/test-codex-usage.cjs' },
  { name: 'Gemini (Antigravity)', eight: '.agents/rules/gemini-8.md', test: null },
];

/** Один адаптер: нарушения — в `problems`, сведения — в `info`. Файла §8 нет — адаптер не установлен, молчание. */
function checkAdapter(root, a, problems, info) {
  if (!fs.existsSync(path.join(root, a.eight))) return;
  if (!a.test) { info.push(`адаптер ${a.name}: не готов — теста соответствия нет, не проверяется`); return; }
  if (!fs.existsSync(path.join(root, a.test))) { problems.push(`адаптер ${a.name}: нет теста соответствия ${a.test}`); return; }
  const bad = runTestFile(root, a.test);
  if (bad) problems.push(`адаптер ${a.name}: ${bad}`);
  else info.push(`адаптер ${a.name}: тест соответствия пройден`);
}

function run({ root, info }) {
  const problems = [];
  const notes = [];
  for (const a of ADAPTERS) checkAdapter(root, a, problems, notes);
  if (!notes.length && !problems.length) problems.push('адаптеров движков нет: ни одного файла §8 не найдено');
  if (info) info.push(...notes.map((l) => '    ✓ ' + l));
  return problems;
}

module.exports = { id: 'adapter-conformance', since: null, run };
