# Словарь: `.agents/plugins/forma/agents/intent.md`

Уровень 2, Gemini/Antigravity-зеркало. Английский оригинал — `.agents/plugins/forma/agents/intent.md`.

## Что это и зачем

Точная копия `.claude/agents/intent.md` по смыслу и объёму для движка Antigravity — полный разбор всех разделов (Открытие цели, Каждая задача, Сверка вида, Закрытие круга, Аварийный протокол, Хозяйство) и критерия приёмки «красиво»/«справедливо» — **см. `living/dictionary/claude-intent.md`**, текст идентичен пункт в пункт.

## Чем именно отличается от Claude-версии

- **Фронтматтер:** `model: gemini-3.1-pro`, инструменты — `browser_subagent` вместо набора `mcp__chrome-devtools__*` (у Claude Code браузерная сверка идёт через отдельные MCP-инструменты навигации/снимка/заполнения формы, у Antigravity — через один субагент-инструмент);
- **Пути:** ссылки на файлы схемы даны от `agents/` и `agents/on-demand/`, а не от `.claude/agents/` — движок Antigravity держит агентов в другом каталоге (`.agents/plugins/forma/agents/`);
- **Перекрёстные ссылки:** там, где Claude-версия ссылается на `CLAUDE.md`, здесь — на `.agents/rules/gemini-8.md`, и наоборот в разделе «Хозяйство» («синхронизация с `CLAUDE.md`»).

Это не сокращённый пересказ — полное содержание, требуемое правилом «`.agents/rules/gemini-8.md`/`.agents/plugins/forma/agents/*.md` — полная копия смысла и объёма, не сжатый адаптер» (`.claude/agents/on-demand/intent-housekeeping.md`).
