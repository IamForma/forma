'use strict';

// Реестр сверки движка Claude Code: то, что `sync-engines.cjs` запускает по кругу. Одна проверка — один файл:
// `{ id, since, run(ctx) }` (форма — `.forma/dashboard/lib/checks.cjs`). Новая проверка — новый файл и одна строка здесь;
// порядок строк — порядок находок в выводе. Проверки ядра (доска, manual, целостность) живут в ядре и подключаются
// сюда по пути; проверки адаптера — рядом. Помощники — в `support/`.

module.exports = [
  require('./root-rules.cjs'),
  require('../../../.forma/dashboard/checks/manual-languages.cjs'),
  require('../../../.forma/dashboard/checks/locale-parity.cjs'),
  ...require('../../../.forma/board/checks/index.cjs'),
  require('./engine-impersonal.cjs'),
  require('../../../.forma/dashboard/checks/core-integrity.cjs'),
  require('./claude-delivery.cjs'),
  require('./adapter-conformance.cjs'),
  require('./codex.cjs'),
];
