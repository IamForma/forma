'use strict';

// Реестр проверок доски — ядро, одни для всех движков. Одна проверка — один файл рядом: `{ id, since, run(ctx) }`
// (форма — `.forma/dashboard/lib/checks.cjs`). Новая проверка — новый файл и одна строка здесь; порядок строк — порядок находок.
// Помощники проверок — в `support/`. Запускает реестр `.forma/board/check-board.cjs`.

module.exports = [
  require('./epics.cjs'),
  require('./route-labels.cjs'),
  require('./route-stage.cjs'),
  require('./status-values.cjs'),
  require('./card-materials.cjs'),
  require('./spend-language.cjs'),
  require('./core-closing.cjs'),
  require('./attempt-parses.cjs'),
  require('./attempt-format.cjs'),
  require('./agent-id.cjs'),
  require('./engine-tag.cjs'),
];
