---
name: graph-build
description: Сборка графов Kit — какой командой строится каждый граф (goals, board, arsenal, structure, resources, central, manual, project, tendons, site, engine-скелет) и как проверить результат. Применять, когда карточка велит построить или обновить граф.
---

# graph-build

Все графы — `.forma/living/graphs/<имя>/graph.json`, формат graphify (`nodes`, `edges`). Все строятся механически, скриптом: разбор frontmatter, заголовков, ссылок, путей, регулярок — без модели. Кэш по хэшу файла: неизменённое не пересчитывается, повторный прогон — «разобрано 0».

## Команды

| Граф | Команда |
|---|---|
| goals, board, arsenal, structure, resources, central | `node .claude/scripts/build-kit-graphs.cjs` (один: `--only goals\|board\|arsenal\|structure\|resources\|central`); `central` объединяет остальные и печатает отчёт об обрывах для Core |
| manual, project | `node .claude/scripts/build-kit-graphs.cjs --only manual` и `--only project` |
| реестр ресурсов (вход resources) | `node .claude/scripts/resources.cjs sort\|inventory\|report` — до графа; `prepare`, `batch`, `apply`, `register`, `decide` — ниже |
| tendons | `node .claude/scripts/build-tendons.cjs` — **последним** |
| site | `node .claude/scripts/build-site-graph.cjs` |
| engine (скелет) | `node .claude/scripts/build-engine-graph.cjs` |
| engine (graph.html) | `node .claude/scripts/build-engine-graph-html.cjs` — для вкладки дашборда |

Граф опыта отдельно не строится: закрытые карточки (`done`) входят в граф `board`.

Порядок: kit-графы → manual/project → tendons. Tendons требует `.forma/living/graphs/manual` и `.forma/living/graphs/project`; их нет — tendons не запускать, назвать в Результате. Граф сайта независим от tendons — своя команда, свой кэш.

**Один прогон за раз.** Второй прогон не запускать и не уводить в фон, пока первый не завершился: общий файл кэша.

### Графы structure и resources

`structure` — зоны и файлы `project/`, рёбра карточка → зона, расход по зонам. `resources` — реестр `project/resources/_assets.json` (ключ sha256): узел `asset:<sha12>`, рёбра `made_by` (карточка), `serves` (цель), `used_in` (зона потребителя), `contains` (зона → ресурс); состояние `в работе` / `в запасе` / `бесхозный`. ТЗ — `project/ops/GRAPHS-STRUCTURE-SITE.md`, правила — `project/config/resources.rules.json`.

Порядок для resources: `resources.cjs sort` (класс ресурс/черновик/неясное; неясное — списком по папкам, решает человек: `resources.cjs decide <папка> resource|draft`) → `inventory` → `prepare`/`batch --n N` (уменьшение до ~1024 px и кадры видео через ffmpeg → `project/work/prep`, манифест `project/work/batch.json`) → агент `asset-describer-haiku` читает манифест и возвращает JSON (один раз по sha256) → `apply <json>` (пишет в реестр скрипт) → `build-kit-graphs.cjs --only resources` → `report` (файл без записи, запись без файла, без описания). Сначала замер на 5–10 файлах, показ человеку, полный прогон — только по его «да». Ничего не удаляется; черновики — в `project/work/` (в `.gitignore`).

### Граф сайта

Узлы: сайт → страница/запись/CPT/шаблон/template_part/меню/медиа → секция (верхнеуровневый `<section id>`, иначе синтетический `content`) → виджет (`heading`/`cta`/`link`). Рёбра: `contains`, `uses_template`, `uses_media`, `made` (карточка → страница, по совпадению ID), `described_in` (страница → файл `project/*.md`).

Снимок — один read-only вызов `novamira/execute-php` через `.claude/scripts/site-php.cjs`; сайт не меняется. Кэш — `.forma/living/graphs/site/.cache.json`.

Проверка числа страниц — сверка со снимком: `node -e "const g=require('./.forma/living/graphs/site/graph.json');console.log(g.nodes.filter(n=>n.type==='page').length)"` против списка опубликованных страниц.

### Граф движка (скелет)

Узлы: файл (`.cjs`/`.js`/`.py`/`.sh` из `.claude/scripts`, `.claude/hooks`, `.forma/board`, `.forma/dashboard`, `.forma/protocol/bin`, `.forma/protocol/scripts`, без `.cache`) → его экспорты. Рёбра: `requires`, `exports`. Зеркала `.codex/` и `.agents/` не обходятся — один узел-зеркало на каталог. Разбор регулярками. Кэш — `.forma/living/graphs/engine/.cache.json`.

Отчёт скрипта (stdout): файлы без входящих `requires` и циклы зависимостей.

## Вопросы к графу

`node .claude/scripts/graph-query.cjs find <текст> [--type T]` · `node <id>` (узел и рёбра по отношениям) · `path <a> <b>` (кратчайший путь) · `digest` (обрывы central). По умолчанию граф `central`, другой — `--graph <имя>`. Автосборка после правок — хук `auto-graphs.sh` (дебаунс 30 с, lock).

## Проверка

Для каждого построенного графа:
`node -e "const g=require('./.forma/living/graphs/<имя>/graph.json');console.log(g.nodes.length,g.edges.length)"`
Готово: JSON читается, узлов и рёбер > 0. В Результат — узлы/рёбра каждого графа.
