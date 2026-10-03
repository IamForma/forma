#!/usr/bin/env node
'use strict';

/**
 * sync-engines.cjs — Детерминированная проверка и синхронизация правил
 * между Claude Code (.claude/ + .claude/rules/claude-8.md), Google Antigravity (.agents/ + .agents/rules/gemini-8.md)
 * и Codex (.codex/ + CODEX-8.md).
 *
 * Claude и Gemini сверяются текстом — их роли равны по содержанию. Codex читает
 * канонический текст Claude по исполнимой ссылке, поэтому проверяется ссылка,
 * конструкция и доступность зеркала навыков (см. checks/codex.cjs).
 *
 * Назначение:
 *   1. Проверить паритет ролей без ручного сличения файлов.
 *   2. Проверить конструкцию корневых правил: AGENTS.md — единственный источник, оба файла-обёртки его импортируют
 *      и не держат своей копии §1–7 (сверять два текста правил больше не нужно — текст один).
 *   3. Дать мгновенный статус для SessionStart-хуков (check-ready.sh) и регламента intent-housekeeping.
 *
 * Использование:
 *   node .claude/scripts/sync-engines.cjs [--check] [--diff] [--quiet] [--file <путь>]
 *
 * Флаги:
 *   --check  (по умолчанию) Сверить пары файлов и вывести статус. Код 0 — паритет, 1 — дрейф.
 *   --diff   Показать строки с расхождениями для файлов, где обнаружен дрейф.
 *   --quiet  Вывести только одну строку статуса (удобно для хуков).
 *   --file   Один файл (хук чистых зон): след проекта — в вывод, код 0 всегда; вне зоны — молчание.
 *
 * Что проверяется: цельность ядра (закон, manual, модуль экономики и его тест соответствия) и каждый
 * установленный адаптер движка — своим тестом соответствия контракту экономики. Адаптер без теста
 * («не готов») называется сведением, не нарушением; паритет ролей Claude↔Gemini и строение .codex/ —
 * тоже только сведения.
 *
 * Проверки — реестр в checks/index.cjs: одна проверка — один файл, скрипт только гоняет их по кругу.
 */

const fs = require('fs');
const path = require('path');

const { runChecks } = require('../../.forma/dashboard/lib/checks.cjs');
const CHECKS = require('./checks/index.cjs');
const { cleanOwn, inCleanZone, scanCleanFile } = require('./checks/support/clean-zone.cjs');
const parity = require('./checks/support/role-parity.cjs');

const ROOT = path.resolve(__dirname, '../..');
const NL = String.fromCharCode(10);

// Проверки, которые сверка гонит по кругу, — в checks/index.cjs. Сведения (не нарушения) проверки кладут
// в ctx.info готовыми строками, в порядке реестра. Метки ниже читает дашборд (.forma/dashboard/data/law.cjs) — порядок и слова держатся.

// --- Третья среда: Codex -----------------------------------------------------
// Проверка codex (checks/codex.cjs): Codex читает канонический текст Claude по ссылке — проверяется ссылочная
// конструкция, а не время правки. Находки — сведения, не нарушения.

// --- Ядро и адаптеры -----------------------------------------------------------
// Ядро одно для всех движков: закон, manual, модуль экономики с тестом соответствия. Адаптер движка
// проверяется своим тестом соответствия контракту экономики (ECONOMY.md).

/** Один файл (хук): след в чистой зоне — вывод, код 0 всегда; вне зоны — молчание. */
function checkOneFile(fileArg) {
  const abs = path.resolve(fileArg || '');
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  if (!rel.startsWith('..') && fs.existsSync(abs) && inCleanZone(rel, cleanOwn(ROOT))) {
    const found = scanCleanFile(rel, fs.readFileSync(abs, 'utf8'));
    if (found.length) console.log(found.join(NL));
  }
  process.exit(0);
}

/** Строка «Корневые правила»: формулировка зависит от устройства Claude-стороны — импорт из корня или подача §8 хуком. */
function rootRulesOk() {
  const claudeNative = !fs.existsSync(path.join(ROOT, 'CLAUDE.md'));
  return claudeNative
    ? 'Корневые правила: \u2713 AGENTS.md — единственный источник §1–7, §8 Claude Code читается из .claude/rules/, §8 Antigravity импортирует\n'
    : 'Корневые правила: \u2713 AGENTS.md — единственный источник §1–7, обе обёртки его импортируют\n';
}

function printReport({ problems, info, results, isDiff }) {
  const hasDrift = problems.length > 0;
  const rule = '='.repeat(70);
  console.log(rule);
  console.log('  СВЕРКА: закон, ядро, адаптеры движков');
  console.log(rule + '\n');

  if (!hasDrift) {
    console.log(rootRulesOk());
  } else {
    console.log('Корневые правила: \u2717 нарушена конструкция');
    for (const problem of problems) console.log(`    — ${problem}`);
    console.log('');
  }

  console.log('Ядро и адаптеры:');
  for (const l of info) console.log(l);
  console.log('');
  for (const l of parity.parityTable(results)) console.log(l);
  console.log('\n' + parity.RULE);

  if (!hasDrift) { console.log('Закон, ядро и готовые адаптеры в порядке.'); return; }
  console.log('Сбой — в проверках выше (конструкция, ядро, адаптеры, доска, журнал).\n');
  if (isDiff) for (const l of parity.driftDetails(results)) console.log(l);
  else console.log('Для просмотра строк с расхождениями запустите с флагом --diff');
}

function main() {
  const args = process.argv.slice(2);
  const fi = args.indexOf('--file');
  if (fi >= 0) checkOneFile(args[fi + 1]);

  const info = [];
  const problems = runChecks(CHECKS, { root: ROOT, info });
  const hasDrift = problems.length > 0;

  if (args.includes('--quiet')) {
    if (hasDrift) console.log(`DRIFT: корневые правила (${problems.length})`);
    else console.log('OK: AGENTS.md — единый закон, ядро цельно, адаптеры движков прошли тест соответствия.');
    process.exit(hasDrift ? 1 : 0);
  }

  printReport({ problems, info, results: parity.compareRoles(ROOT), isDiff: args.includes('--diff') });
  process.exit(hasDrift ? 1 : 0);
}

main();
