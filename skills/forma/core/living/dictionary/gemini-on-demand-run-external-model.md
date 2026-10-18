# Словарь: `.agents/plugins/forma/agents/on-demand/run-external-model.md`

Уровень 2b, Gemini/Antigravity-зеркало. Английский оригинал — `.agents/plugins/forma/agents/on-demand/run-external-model.md`.

## Что это и зачем

Точная копия `.claude/agents/on-demand/run-external-model.md` по смыслу и объёму — единственное исключение из правила «строку расхода пишет вызывающий», потому что у моста-вызова снаружи нет вызывающего вообще — **см. `living/dictionary/claude-on-demand-run-external-model.md`**, текст идентичен пункт в пункт, включая упоминание того же конкретного `external-model-bridge.cjs`.

## Чем именно отличается от Claude-версии

Только путь к файлу-триггеру в заголовке (без `.claude/`) и ссылка на `.agents/rules/gemini-8.md` §3 вместо `CLAUDE.md` §3. Технический мост (`external-model-bridge.cjs`, DeepSeek/OpenRouter) у Antigravity-стороны в этом конкретном файле остался тем же самым — в отличие от `gemini-spec.md`, где формулировка про внешний канал обобщена, здесь она сохранена дословно, потому что это единственное место, объясняющее механику конкретного моста, а не абстрактный выбор канала.
