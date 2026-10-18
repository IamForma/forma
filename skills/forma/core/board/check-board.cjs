#!/usr/bin/env node
// Проверка доски .devtool/features/ — часть ядра, одна для всех движков (AGENTS.md §6–7).
// Эпики и цели, метки маршрута и этапы, материалы карточек, строки расхода (§3), закрытие Core.
// Сами проверки — реестр `.forma/board/checks/`: одна проверка — один файл, порядок — в `.forma/board/checks/index.cjs`.
//
//   node .forma/board/check-board.cjs [<card-id>]   — все нарушения доски; с <card-id> — только строки этой карточки.
//   Выход: 0 — нарушений нет, 1 — есть (печатаются по строке, с префиксом «— »).
// Модуль: require('./check-board.cjs').checkBoard(root) → [строки нарушений]. Движок вызывает его
// из своей сверки (sync-engines) и из своего хука записи карточки.

const path = require('path');
const { runChecks } = require('../dashboard/lib/checks.cjs');
const CHECKS = require('./checks/index.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

/** Нарушения доски проекта `root` (по умолчанию — проект, в котором лежит скрипт), в порядке реестра. */
function checkBoard(root) {
  return runChecks(CHECKS, { root: root ? path.resolve(root) : ROOT });
}

module.exports = { checkBoard, CHECKS };

if (require.main === module) {
  const id = process.argv[2];
  const problems = checkBoard().filter((p) => !id || p.includes(id));
  for (const p of problems) console.log('    — ' + p);
  process.exit(problems.length ? 1 : 0);
}
