# Шаблоны движка Forma для Google Gemini (Antigravity)

Этот каталог содержит исходные шаблоны протокола «Форма», адаптированные для выполнения в среде **Google Antigravity** на базе моделей семейства **Gemini** (`gemini-3.1-pro` и `gemini-3.8-flash`).

## Состав

* `.agents/rules/gemini-8.md` — главный управляющий манифест протокола (аналог `CLAUDE.md`, загружается Antigravity).
* `mcp_config.json` — конфигурация инструментов MCP для Antigravity.
* `plugin.json` — манифест плагина для `.agents/plugins/forma/`.
* `agents/` — 5 специализированных ролей-узлов под модели Gemini:
  * `intent.md` — Замысел (`gemini-3.1-pro`)
  * `spec.md` — Спецификация и нарезка (`gemini-3.1-pro`, reasoning effort: high)
  * `kit.md` — Снаряжение (`gemini-3.8-flash`)
  * `run.md` — Исполнение (`gemini-3.8-flash`, reasoning effort: low)
  * `core.md` — Центр и арбитр (`gemini-3.1-pro`, reasoning effort: high/extra_high)

## Установка в проект

1. Скопировать `.agents/rules/gemini-8.md` в корень проекта.
2. Скопировать `mcp_config.json` в `.agents/mcp_config.json`.
3. Разместить `plugin.json` и папку `agents/` в `.agents/plugins/forma/`.
4. Скопировать `forma-adapter.cjs` в `.agents/forma-adapter.cjs` — по нему дашборд показывает вкладку движка на «Форме».
