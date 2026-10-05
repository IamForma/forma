'use strict';

// Ядро одно для всех движков: закон, manual, модуль экономики с тестом соответствия, интервью, доска, дашборд.
// Проверка ядра; в реестр её ставит сверка движка. Адаптер движка проверяется отдельно — своим тестом соответствия
// контракту экономики (ECONOMY.md).

const fs = require('fs');
const path = require('path');
const { walk } = require('../lib/fs.cjs');
const { runTestFile } = require('../lib/checks.cjs');

const NEED = ['AGENTS.md', '.forma/manual/en/03-forma/ECONOMY.md', '.forma/manual/ru/03-forma/ECONOMY.md',
  '.forma/dashboard/economy.cjs', '.forma/dashboard/economy.test.cjs', '.forma/dashboard/tally.cjs', '.forma/dashboard/spend-line.cjs'];
const PARTS = ['.forma/skills/grilling/SKILL.md', '.forma/skills/forma-grill-with-ui/SKILL.md', '.forma/skills/forma-grill-with-ui/server.mjs',
  '.forma/board/new-card.cjs', '.forma/board/check-board.cjs', '.forma/board/DATA-MODEL.md', '.devtool/features', '.forma/dashboard/generate.js'];
// Части ядра без движка: путь или имя движка в них — нарушение. Имена собраны из частей: проверка, что ищет
// привязку к движку, не должна быть привязана сама.
const ENGINE_FREE_DIRS = ['.forma/skills/grilling', '.forma/skills/forma-grill-with-ui', '.forma/board'];
const ENGINE_DIRS = ['cla' + 'ude', 'co' + 'dex', 'age' + 'nts'].join('|');
const ENGINE_BOUND = new RegExp('\\.(' + ENGINE_DIRS + ')[/\\\\]|\\bClau' + 'de Code\\b|\\bMonitor tool\\b');

const exists = (root, rel) => fs.existsSync(path.join(root, rel));

/** Части ядра, привязанные к движку: `ядро: <каталог>/<файл> привязан к движку — «<совпадение>»`. */
function engineBoundProblems(root) {
  const problems = [];
  for (const dir of ENGINE_FREE_DIRS) {
    for (const f of walk(path.join(root, dir)).sort()) {
      const m = fs.readFileSync(path.join(root, dir, f), 'utf8').match(ENGINE_BOUND);
      if (m) problems.push(`ядро: ${dir}/${f} привязан к движку — «${m[0]}»`);
    }
  }
  return problems;
}

function run({ root }) {
  const missing = NEED.filter((rel) => !exists(root, rel));
  const problems = missing.map((rel) => `ядро: нет ${rel}`);
  for (const rel of PARTS) if (!exists(root, rel)) problems.push(`ядро: нет ${rel}`);
  problems.push(...engineBoundProblems(root));
  if (!missing.includes('.forma/dashboard/economy.test.cjs') && !missing.includes('.forma/dashboard/economy.cjs')) {
    const bad = runTestFile(root, '.forma/dashboard/economy.test.cjs');
    if (bad) problems.push('ядро: ' + bad);
  }
  return problems;
}

module.exports = { id: 'core-integrity', since: null, run };
