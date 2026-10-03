# Словарь схемы

По одному документу на каждый переведённый на английский файл уровней 1/2/2b — что это, зачем это, как это работает, по-русски. Разбор самой идеи (почему механика на английском, а пояснение на русском) — `manual/ru/03-forma/PROTOCOL.md`, «Язык схемы и язык объяснения — разные роли, не одно и то же».

## Уровень 1 — общее для всех узлов

- [`AGENTS.md.md`](AGENTS.md.md) — закон протокола, §1–7: один файл на все среды, источник правды
- [`CLAUDE.md.md`](CLAUDE.md.md) — обёртка Claude Code: импорт + §8 движка
- [`gemini-8.md.md`](gemini-8.md.md) — обёртка Antigravity/Gemini: импорт + §8 движка

## Уровень 2 — роль узла (Claude-сторона)

- [`claude-intent.md`](claude-intent.md)
- [`claude-spec.md`](claude-spec.md)
- [`claude-kit.md`](claude-kit.md)
- [`claude-run.md`](claude-run.md)
- [`claude-core.md`](claude-core.md)

## Уровень 2 — роль узла (Gemini-зеркало)

- [`gemini-intent.md`](gemini-intent.md)
- [`gemini-spec.md`](gemini-spec.md)
- [`gemini-kit.md`](gemini-kit.md)
- [`gemini-run.md`](gemini-run.md)
- [`gemini-core.md`](gemini-core.md)

## Уровень 2b — по требованию (Claude-сторона)

- [`claude-on-demand-intent-goal-opening.md`](claude-on-demand-intent-goal-opening.md)
- [`claude-on-demand-intent-housekeeping.md`](claude-on-demand-intent-housekeeping.md)
- [`claude-on-demand-kit-recon.md`](claude-on-demand-kit-recon.md)
- [`claude-on-demand-kit-project-kitting.md`](claude-on-demand-kit-project-kitting.md)
- [`claude-on-demand-run-external-model.md`](claude-on-demand-run-external-model.md)

## Уровень 2b — по требованию (Gemini-зеркало)

- [`gemini-on-demand-intent-goal-opening.md`](gemini-on-demand-intent-goal-opening.md)
- [`gemini-on-demand-intent-housekeeping.md`](gemini-on-demand-intent-housekeeping.md)
- [`gemini-on-demand-kit-recon.md`](gemini-on-demand-kit-recon.md)
- [`gemini-on-demand-kit-project-kitting.md`](gemini-on-demand-kit-project-kitting.md)
- [`gemini-on-demand-run-external-model.md`](gemini-on-demand-run-external-model.md)

Gemini-документы не дублируют пояснение целиком — где содержание идентично Claude-стороне, они ссылаются на соответствующий `claude-*` документ и описывают только фактическую разницу (фронтматтер, пути, конкретные инструменты движка).

Уровни 3 и 4 (`manual/` целиком, `project/`, `.devtool/features/`) остаются на русском — это данные и устройство конкретного проекта, не механика схемы; словарь для них не заводится.
