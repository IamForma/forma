# Словарь: `.agents/plugins/forma/agents/on-demand/intent-housekeeping.md`

Уровень 2b, Gemini/Antigravity-зеркало. Английский оригинал — `.agents/plugins/forma/agents/on-demand/intent-housekeeping.md`.

## Что это и зачем

Точная копия `.claude/agents/on-demand/intent-housekeeping.md` по смыслу и объёму — прямая правка файлов схемы, правило полной синхронности `.agents/rules/gemini-8.md`↔`CLAUDE.md`, механика `guard-delete.sh` — **см. `living/dictionary/claude-on-demand-intent-housekeeping.md`**, текст идентичен пункт в пункт, с одним зеркальным разворотом направления: формулировка «синхронизацию с `CLAUDE.md`» вместо «синхронизацию с `.agents/rules/gemini-8.md`» (файл описывает то же самое правило с точки зрения противоположной стороны).

## Чем именно отличается от Claude-версии

Только направление синхронизации (см. выше) и путь к самому себе в заголовке-триггере (`agents/on-demand/intent-housekeeping.md`, без `.claude/`). Это один из двух файлов схемы (второй — Claude-версия), которые буквально и намеренно содержат друг о друге взаимные ссылки — сам факт их дословного совпадения, кроме направления стрелки, и есть механизм, который держит два движка в синхроне.
