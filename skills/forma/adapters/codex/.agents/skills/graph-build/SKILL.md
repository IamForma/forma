---
name: graph-build
description: Сборка графов Kit — какой командой строится каждый граф (goals, board, arsenal, done-cards, tendons, manual, project, site), что делать при 429 и битой записи кэша, как проверить результат. Применять, когда карточка велит построить или обновить граф.
---

# graph-build

Все графы — `.forma/living/graphs/<имя>/graph.json`, формат graphify (`nodes`, `edges`). Кэш по хэшу файла (или сущности): неизменённое не пересчитывается, повторный запуск дёшев.

## Команды

| Граф | Команда | Модель |
|---|---|---|
| goals, board, arsenal | `node .claude/scripts/build-kit-graphs.cjs` (один: `--only goals\|board\|arsenal`) | нет |
| done-cards (опыт) | `node .claude/scripts/build-done-cards-graph.cjs --channel=external` | `deepseek/deepseek-v4-flash`, OpenRouter, ключ `OPENROUTER_API_KEY` (`.env`) |
| tendons | `node .claude/scripts/build-tendons.cjs` — **последним** | нет |
| manual, project | `node .claude/scripts/build-done-cards-graph.cjs --corpus=manual --channel=external` (и `--corpus=project`); сначала `--dry-run` — список cache-miss и оценка токенов без модели; `--limit=N` — пробный прогон на N файлах. Только `*.md` | то же, что done-cards |
| done-cards/manual/project, OpenRouter недоступен из среды | добавить `--provider=deepseek` к той же команде — прямой DeepSeek API через мост (как у слоя смысла движка), ключ `DEEPSEEK_API_KEY` (`.env`); без флага — прежний путь (OpenRouter) | `deepseek/deepseek-v4-flash`, прямой DeepSeek |
| site | `node .claude/scripts/build-site-graph.cjs` | нет |
| engine (скелет) | `node .claude/scripts/build-engine-graph.cjs` | нет |
| engine (слой смысла) | `node .claude/scripts/build-engine-meaning.cjs` — после скелета; `--dry-run`/`--limit=N` как у done-cards | `deepseek/deepseek-v4-flash`, прямой DeepSeek API (`--provider deepseek`), ключ `DEEPSEEK_API_KEY` (`.env`) |
| engine (graph.html) | `node .claude/scripts/build-engine-graph-html.cjs` — после слоя смысла, для вкладки дашборда | нет (тот же Python-рендерер `graphify.to_html`, что у site) |

Порядок: kit-графы → done-cards → manual/project → tendons. Tendons требует `.forma/living/graphs/manual` и `.forma/living/graphs/project`; их нет — tendons не запускать, назвать в Результате. **Граф сайта независим от tendons** — своя команда, свой кэш, не входит в цепочку и ничего в неё не добавляет.

### Граф сайта

Узлы: сайт → страница/запись/CPT/шаблон/template_part/меню/медиа → секция (верхнеуровневый `<section id>`, иначе один синтетический `content`) → виджет (`heading`/`cta`/`link`, по H1–H3 и ссылкам внутри секции). Рёбра: `contains`, `uses_template`, `uses_media`, `made` (карточка → страница, по совпадению ID в тексте карточки с реальным ID сущности), `described_in` (страница → файл `project/*.md`, та же проверка совпадения ID).

Снимок — **один** read-only вызов `novamira/execute-php` через `.claude/scripts/site-php.cjs` (PHP-код зашит в скрипте, без записывающих вызовов; `site-php.cjs` сам отклонил бы запись без `--write`). Сайт не меняется. Кэш — `.forma/living/graphs/site/.cache.json`, по хэшу контента+шаблона+заголовка каждой сущности; страница вне снимка (удалена на сайте) уходит из кэша.

Проверка числа страниц — сверка со снимком той же команды: `node -e "const g=require('./.forma/living/graphs/site/graph.json');console.log(g.nodes.filter(n=>n.type==='page').length)"` против списка опубликованных страниц (видно в сводке скрипта и в `novamira --site <slug> --json run core/get-site-info`).

### Граф движка

Узлы: файл (`.cjs`/`.js`/`.py`/`.sh` из `.claude/scripts`, `.claude/hooks`, `.forma/board`, `.forma/dashboard`, `.forma/protocol/bin`, `.forma/protocol/scripts`, без `.cache`) → его экспорты (`module.exports`/`exports.*`, `def`/`class` верхнего уровня у `.py`). Рёбра: `requires` (файл → файл, по `require`/`import`/`source`/вызову другого скрипта), `exports` (файл → его экспорт). Зеркала `.codex/` и `.agents/` не обходятся — ссылка туда сворачивается в один узел-зеркало на каталог (`mirror:codex`, `mirror:agents`), не в файл. Разбор регулярками, без модели. Кэш — `.forma/living/graphs/engine/.cache.json`, по хэшу содержимого файла.

Отчёт скрипта (в stdout, не в JSON): файлы без входящих `requires` (точки входа) и циклы зависимостей, если есть.

**Слой смысла** (`build-engine-meaning.cjs`, после скелета) добавляет каждому узлу-файлу `description` (одна фраза, за что отвечает), `capabilities` (2-6 пунктов) и `group` — детерминированную группу-модуль по пути (`hooks`, `.forma/board`, `sync-engines`, `adapters`, `economy`, `graphs`, `.forma/dashboard`, `translate`, `scripts` — покрывают все файлы, без остатка). Группа бесплатна (без модели), описание и возможности — только для cache-miss по хэшу содержимого файла; кэш — `.forma/living/graphs/engine/.meaning-cache.json`. Эти `description`/`capabilities` — вход для рёбер «реализует правило» в `build-tendons.cjs` (движок → граф мануала и закона); граф движка для этого не обязателен — нет файла или слоя смысла, секция в сухожилиях просто пустая.

**Один прогон за раз.** Не запускать второй прогон (любой корпус) и не уводить прогон в фон, пока первый не завершился: общий файл кэша, два процесса ломают друг друга. Долгий прогон — ждать на переднем плане.

**Граф опыта — только закрытые Core.** Корпус done-cards берёт карточки `done/` с `assignee: null`; с `"Core"` пропускает и пишет их число. Хэш кэша считается без раздела `## История`/`## History` — дописанная строка расхода не инвалидирует кэш.

Без `--channel=external` скрипт done-cards печатает список промахов и выходит с кодом 3 — это не ошибка, а канал internal; Run им не пользуется.

## Сбои

- **429 upstream** (в выводе bridge): не тарифицируется. Дождаться конца прогона и запустить ту же команду ещё раз — закэшированное пропустится, досниматся только упавшие. Три запуска подряд с 429 на тех же файлах — стоп, в Результат список файлов.
- **Пустое извлечение / невалидный JSON** у файла (в кэше `.forma/dashboard/.cache/graphify-extract-cache.json` запись с `nodes: []` или прогон назвал файл): удалить запись этого файла из кэша и запустить заново:
  `node -e "const f='.forma/dashboard/.cache/graphify-extract-cache.json',c=require('./'+f);delete c['<относительный путь карточки>'];require('fs').writeFileSync(f,JSON.stringify(c,null,2))"`
  Потраченное на битую запись — в стоимость, не теряется.
- **Массовые промахи кэша.** Перед каждым реальным прогоном — `--dry-run` того же корпуса; число cache-miss сверить с ожидаемым в карточке. Расхождение больше 2× — стоп, реальный прогон не запускать, в Результат обе цифры.
- **Обрыв прогона** (лимит сессии, таймаут, kill): повторить ту же команду без изменений. Каждое извлечение пишется в кэш сразу после ответа модели — сделанное берётся из кэша как cache-hit, оплачивается только остаток. Кэш не чистить.
- **Потолок бюджета** (`.forma/dashboard/graphify.config.json` → `budget.maxUsdPerBuild`): прогон встал, метка `.forma/dashboard/.cache/graphify-budget-stop.json`. Потолок не поднимать — стоп, вернуть карточку.

## Проверка

Для каждого построенного графа:
`node -e "const g=require('./.forma/living/graphs/<имя>/graph.json');console.log(g.nodes.length,g.edges.length)"`
Готово: JSON читается, узлов и рёбер > 0. Для done-cards ещё: cache-miss в повторном `--dry-run` = 0, пустых извлечений 0. В Результат — узлы/рёбра каждого графа и фактическая стоимость (сумма `cost` из вывода).

Стоимость строки расхода внешней модели пишет исполнитель (`AGENTS.md` §3; `.forma/manual/en/03-forma/ECONOMY.md`, "External model and external service"): `$X.XXXXXX (openrouter/deepseek/deepseek-v4-flash)`, id — `` `id unknown` `` (мост id не возвращает).
