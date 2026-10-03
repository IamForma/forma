# Журнал протокола «Форма»

Что изменилось на уровне Движка (`AGENTS.md`, `manual/`, `.claude/agents/`) и что каждое изменение чинит. Запись держит дату решения; новые — сверху.

- **0.4.175** — **Установщик и синхронизация клона переведены на раскладку `.forma/`.**
  **Что сделано.** `bin/forma.cjs`: ядро (`manual/`, `board/`, `skills/`, `dashboard/`, `living/`) кладётся под `.forma/` проекта, не в корень; `.gitignore` правит `.forma/dashboard/.cache/`. `scripts/engine-to-protocol.cjs`: карта путей переведена на `.forma/dashboard`, `.forma/manual`, `.forma/skills`, `.forma/board` ядра. Попутно исправлены два дефекта, блокировавшие `npm test`: заниженный `maxBuffer` у `spawnSync` в тестовом хелпере (вывод сборки данных вырос и валил процесс по `SIGTERM`), и два места (`dashboard-view.cjs`, `build-kit-graphs.cjs`), где прежний автоматический перенос ошибочно превратил буквальный путь `.claude/skills` в `.claude/skills`.
  **Что осталось.** Решение о выпуске версии — за человеком.
