# Форма: WordPress-разработка (Novamira)

Необязательный компаньон-плагин к [«Форма»](../../README.md), лежит в её каталоге `templates/` — разработка WordPress с помощью Novamira MCP (+ Elementor), готовый набор с Aura/Magnific в комплекте. Устанавливается отдельно, поверх базового `forma`, только если дело — именно такого рода.

## Что внутри

Три скилла активны сразу после установки плагина — копировать не нужно:

| Скилл | Для чего |
|---|---|
| `novamira-wp-deploy` | безопасная работа с WordPress через Novamira MCP — аутентификация, sandbox→продакшен, кеш, персистентность |
| `novamira-wp-elementor` | сборка страниц в Elementor через MCP — контейнеры, ширина, Theme Builder conditions |

Четвёртый — `forma-wordpress-novamira` — не готовый рецепт, а установщик: кладёт в текущий проект пустую заготовку `project/SITE.md` (архитектурный снимок конкретного сайта — своя для каждого проекта, поэтому не может идти общей для всех, кто ставит этот плагин; продуктовые данные сайта живут только в `project/`).

## Установка

```
claude plugin marketplace add IamForma/forma   # если ещё не добавлен
claude plugin install forma-wordpress-novamira@forma
# в проекте:
"разверни заготовку project/SITE.md" (или /forma-wordpress-novamira)
```

**Если «Форма» стоит git-клоном (способ 1)** — шаблон уже лежит в `protocol/templates/forma-wordpress-novamira/`, плагин не нужен. В сессии проекта:

```
скопируй скиллы из protocol/templates/forma-wordpress-novamira/skills/ в .claude/skills/ (кроме forma-wordpress-novamira)
прочитай protocol/templates/forma-wordpress-novamira/skills/forma-wordpress-novamira/SKILL.md и установи по нему шаблон проекта
```

## MCP-серверы этого стека

Плагин их не подключает сам — у Claude Code нет способа поставить внешний MCP-сервер с чужими учётными данными автоматически, только запустить уже настроенный. Ниже — что обычно нужно подключить вручную, под конкретный проект:

| MCP | Зачем | Как подключить |
|---|---|---|
| Novamira | Мост в WordPress конкретного сайта — `execute-php`, файлы, контент, Voxel/Elementor-abilities | плагин Novamira ставится на сам сайт, коннектор — `claude mcp add` (или `/mcp`) с адресом REST-эндпойнта и своими учётными данными (Application Password или OAuth, см. `novamira-wp-deploy` ЗАКОН №1) — свой на каждый сайт |
| Aura | Генерация изображений, публикация сайта | коннектор claude.ai, подключается в настройках коннекторов аккаунта |
| Magnific | Изображения/видео/аудио/3D-генерация | коннектор claude.ai, подключается в настройках коннекторов аккаунта |

## Структура

| Путь | За что отвечает |
|---|---|
| `.claude-plugin/plugin.json` | манифест этого плагина |
| `skills/novamira-wp-deploy/SKILL.md` | правила работы с WordPress через Novamira MCP |
| `skills/novamira-wp-elementor/SKILL.md` | правила сборки в Elementor через MCP |
| `skills/forma-wordpress-novamira/SKILL.md` | установщик — кладёт заготовку `project/SITE.md` в целевой проект |
| `skills/forma-wordpress-novamira/template/project/SITE.md` | сама заготовка: пустой каркас архитектурного снимка сайта |
| `skills/forma-wordpress-novamira/template/scripts/` | скрипты сайта и переводов → `.claude/scripts/` проекта: `site.cjs` (novamira CLI на `SITE_SLUG` из `.env`), `site-php.cjs` (PHP-файл на сайт через execute-php, отчёт JSON), `loco-pipeline.py` (перевод ru_RU.po плагинов Loco одним прогоном), `tokenator_translator.py` (автоперевод .po через `TOKENATOR_API_KEY`), `po_shift_check.py` (поиск съехавших переводов в .po). Ключи и сайт — только из `.env` |

## Известные ограничения версии 0.0.1

- не проверено живой установкой в отдельном проекте;
- навыки содержат только переносимую методику. Факты, примеры и инциденты конкретного сайта хранятся в `project/SITE.md` и опыте этого проекта, а не в шаблоне.
