# Сборка адаптера движка

Для движка без готового адаптера (Codex, Gemini): как собрать свой адаптер по образцу Claude Code.

Для разработчиков протокола; в проекты не устанавливается. Пути образцов — относительно этого репозитория; `.codex/`, `.agents/`, `GEMINI.md` — пути в установленном проекте.

## Граница ядро / адаптер

| Ядро — общее, не правится под движок | Адаптер — свой у каждого движка |
|---|---|
| `skills/forma/core/AGENTS.md` (§1–7) | файл §8 (образец `skills/forma/adapters/claude/rules/claude-8.md`) |
| `skills/forma/core/manual/ru/03-forma/ECONOMY.md` — контракт экономики | роли (образец `skills/forma/adapters/claude/agents/`) |
| `skills/forma/core/dashboard/economy.cjs` — одна математика | хуки (образец `skills/forma/adapters/claude/hooks/`) |
| `skills/forma/core/dashboard/spend-line.cjs` — запись строки расхода | модуль экономики (образец `skills/forma/adapters/claude/scripts/claude-economy.cjs`) |
| `skills/forma/core/board/` — проверка и создание карточек | тест соответствия (образец `skills/forma/adapters/claude/scripts/claude-economy.test.cjs`) |
| `skills/` — скиллы интервью | |
| `dashboard/` | |

## Семь пунктов сверки

| # | Вопрос к движку | Образец Claude |
|---|---|---|
| 1 | Как движок получает `AGENTS.md` целиком при старте — нативно или импортом из файла §8? | `skills/forma/adapters/claude/rules/claude-8.md` (нативное чтение; запасной хук `skills/forma/adapters/claude/hooks/load-engine-section.sh`) |
| 2 | Какие поля ответа вызова дают N (токены), R (cache-read), T (длительность), id вызова? Чего нет — `unknown`, не 0 | `skills/forma/adapters/claude/rules/claude-8.md`, таблица полей |
| 3 | Где лежит стенограмма вызова и основной сессии, откуда читается R, если его нет в ответе? | `skills/forma/adapters/claude/dashboard/subagent-transcript.cjs` |
| 4 | Где имена полей движка превращаются в канонические переменные `ECONOMY.md`, и какой тест это доказывает? | `skills/forma/adapters/claude/scripts/claude-economy.cjs`, `skills/forma/adapters/claude/scripts/claude-economy.test.cjs` |
| 5 | Где лежат роли пяти узлов и как вызывается отдельный агент? Нет изоляции — деградированный режим, `AGENTS.md` §2 | `skills/forma/adapters/claude/agents/` |
| 6 | Чем движок держит: запрет удаления (§1), проверку карточки при записи, доставку `intent.md` на старте сессии? | `skills/forma/adapters/claude/hooks/guard-delete.sh`, `skills/forma/adapters/claude/hooks/check-card.sh`, `skills/forma/adapters/claude/hooks/intent-start.sh` |
| 7 | Как скиллы интервью ядра (`skills/forma/core/skills/`) доходят до движка — копией, ссылкой? | `skills/forma/core/skills/` → `skills/forma/adapters/claude/skills/` копией (сверяет `checkClaudeDelivery` в `skills/forma/adapters/claude/scripts/sync-engines.cjs`) |

## Критерий «готов»

`node .claude/scripts/sync-engines.cjs --check`, список `ADAPTERS`:

- адаптер найден — есть его файл §8 (`.codex/CODEX-8.md`, `.agents/rules/gemini-8.md`);
- `test: null` — сведение «не готов — теста соответствия нет, не проверяется», не нарушение;
- путь теста указан, файла нет — нарушение «нет теста соответствия»;
- тест есть, падает — нарушение; проходит — «тест соответствия пройден» = **готов**.

Путь своего теста в `ADAPTERS` вписывает не сам движок (файл в зоне Claude) — он называет путь человеку.

## Правило зон

Движок правит только своё: Codex — `.codex/`, Gemini — `.agents/` и `GEMINI.md`. Образец Claude — для сравнения, не для копирования: чужие допущения о непроверенной среде не переносятся. Расхождение в чужой зоне называется человеку фактом.
