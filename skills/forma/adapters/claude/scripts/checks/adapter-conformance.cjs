'use strict';

// Адаптер движка найден по файлу §8; готов — если несёт тест соответствия контракту экономики (ECONOMY.md).
// Не готов — сведение (строка в `ctx.info`, готовая к печати), не нарушение.

const fs = require('fs');
const path = require('path');
const { runTestFile } = require('../../../.forma/dashboard/lib/checks.cjs');
const { isDormant } = require('./support/dormant.cjs');

// Codex не объявляет forma-adapter.cjs — его строка статична; остальные движки берутся из адаптеров проекта.
const STATIC = [{ id: 'codex', name: 'Codex', eight: '.codex/CODEX-8.md', test: '.codex/tests/test-codex-usage.cjs' }];
const TEST_RE = /^(test-.*(adapter|usage).*\.cjs|.*(economy|adapter)\.test\.cjs)$/;

/** Тест соответствия адаптера: первый подходящий файл в его testsDir, затем в scriptsDir. */
function findTest(root, src) {
  for (const dir of [src.testsDir, src.scriptsDir]) {
    if (!dir) continue;
    const abs = path.join(root, ...dir.split('/'));
    let names = [];
    try { names = fs.readdirSync(abs).sort(); } catch { continue; }
    const hit = names.find((n) => TEST_RE.test(n));
    if (hit) return dir + '/' + hit;
  }
  return null;
}

/** Адаптеры проекта (папка с forma-adapter.cjs) и статичные: [{ id?, name, eight, test }]. */
function listAdapters(root) {
  const E = require('../../../.forma/dashboard/lib/engines.cjs');
  const found = E.loadAdapters(root)
    .filter((a) => typeof a.engineRulesFile === 'string')
    .map((a) => ({ id: E.idOf(a), name: a.engine || E.idOf(a), eight: a.engineRulesFile, test: findTest(root, E.sourcesOf(a)) }));
  return [...found, ...STATIC];
}

/** Один адаптер: нарушения — в `problems`, сведения — в `info`. Файла §8 нет — адаптер не установлен, молчание. */
function checkAdapter(root, a, problems, info) {
  if (!fs.existsSync(path.join(root, a.eight))) return;
  if (a.id && isDormant(root, a.id)) { info.push(`адаптер ${a.name}: спящий режим — тест соответствия не запускается`); return; }
  if (!a.test) { info.push(`адаптер ${a.name}: не готов — теста соответствия нет, не проверяется`); return; }
  if (!fs.existsSync(path.join(root, a.test))) { problems.push(`адаптер ${a.name}: нет теста соответствия ${a.test}`); return; }
  const bad = runTestFile(root, a.test);
  if (bad) problems.push(`адаптер ${a.name}: ${bad}`);
  else info.push(`адаптер ${a.name}: тест соответствия пройден`);
}

function run({ root, info }) {
  const problems = [];
  const notes = [];
  for (const a of listAdapters(root)) checkAdapter(root, a, problems, notes);
  if (!notes.length && !problems.length) problems.push('адаптеров движков нет: ни одного файла §8 не найдено');
  if (info) info.push(...notes.map((l) => '    ✓ ' + l));
  return problems;
}

module.exports = { id: 'adapter-conformance', since: null, run };
