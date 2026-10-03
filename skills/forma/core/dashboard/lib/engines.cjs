'use strict';

/**
 * Граница ядро — адаптер движка. Ядро не знает ни имени движка, ни каталога его адаптера:
 * оно спрашивает у адаптеров то, что знает только движок, и живёт без ответа.
 *
 * Поиск: `loadAdapters(root)` перебирает каталоги корня проекта, чьё имя начинается с точки,
 * и подключает `<каталог>/forma-adapter.cjs`, если он есть. Модуль не найден или бросил при
 * загрузке — адаптера нет, это не падение. Порядок — по имени каталога.
 *
 * Форма адаптера — объект с необязательными полями. Пути — от корня проекта, через `/`.
 * Нет поля или нет адаптера — ядро кладёт в данные `unknown` (строкой) либо пустой список
 * там, где UI ждёт список; ноль и `null` на место числа не идут.
 *
 *   поле                   что это                                         при отсутствии
 *   engine                 тег движка, строка ('claude-code')              'unknown'
 *   instructionWeight()    вес закона и роли на шаг вызова: { common,      блок веса не строится,
 *                          byNode: { Узел: { perStep } } }                 в данных 'unknown'
 *   stepsFromCacheRead(cacheRead, perStep) — число шагов по кэш-чтению     'unknown'
 *   toolUsage              разбор журнала инструментов: { source,          ярус узлов «Борта» без
 *                          readDeclared(dirAbs), readLog(fileAbs),         источника (source: null)
 *                          baseName(decl) }
 *   parseUsage(step)       шаг стенограммы → { tokens_in, tokens_out,      расход стенограммы — null
 *                          cache_read, cache_write }
 *   transcriptsDir(root)   каталог стенограмм проекта, абсолютный | null   стенограмм нет
 *   rolesDir               каталог ролей узлов                             роли не читаются
 *   onDemandRolesDir       каталог ролей «по случаю»                       не читаются
 *   engineRulesFile        файл §8 — правила движка                        текст пустой
 *   skillsDir              каталог скиллов проекта                         'unknown' вместо числа
 *   templateSkills         имена умений, что поставляет шаблон (список)    признак умений «—»
 *   syncScript             скрипт сверки движков; вызывается с --check     сверка не запускается
 *   doneCardsGraphScript   сборщик графа сделанных карточек                сборка невозможна
 *   usageRefresh           [{ script, args, cache }] — скрипты, что         кэши расхода не
 *                          обновляют кэш расхода диалога в .forma/dashboard/.cache обновляются ядром
 *   mcpConfigs(root)       [{ rel, file, level }] — файлы MCP-серверов     серверов нет, список пуст
 *   engineSettings(root)   { present, env, hooks, nodes, skills, mcp,      present: false, пустые списки
 *                          check } — вкладка «Движок»
 *   formaRoles(root)       { title, nodes[], runRoles[], runNote, rolesMissing,  вкладки движка нет
 *                          plugins? } — срез ролей для вкладки «Форма»;
 *                          по вкладке на каждый адаптер с этим полем
 *   structure              { key, title, note, roots, notes } — группа     группы в «Структуре» нет
 *                          дерева «Структура»; notes — подписи каталогов
 *
 * Полей несколько адаптеров: одиночные берутся у первого, кто их объявил; списки склеиваются.
 */

const fs = require('fs');
const path = require('path');

const ADAPTER_FILE = 'forma-adapter.cjs';
const UNKNOWN = 'unknown';

/** Тип каждого поля формы; проверяет `validateAdapter`. */
const SHAPE = {
  engine: 'string',
  instructionWeight: 'function',
  stepsFromCacheRead: 'function',
  toolUsage: 'object',
  parseUsage: 'function',
  transcriptsDir: 'function',
  rolesDir: 'string',
  onDemandRolesDir: 'string',
  engineRulesFile: 'string',
  skillsDir: 'string',
  templateSkills: 'array',
  syncScript: 'string',
  doneCardsGraphScript: 'string',
  usageRefresh: 'array',
  mcpConfigs: 'function',
  engineSettings: 'function',
  formaRoles: 'function',
  structure: 'object',
};

const typeOf = (v) => (Array.isArray(v) ? 'array' : typeof v);

/** Что не так с адаптером: пустой список — форма соблюдена. Поле, которого нет, не ошибка. */
function validateAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') return ['адаптер — не объект'];
  const problems = [];
  for (const [field, type] of Object.entries(SHAPE)) {
    if (adapter[field] == null) continue;
    if (typeOf(adapter[field]) !== type) problems.push(`${field}: ждали ${type}, пришло ${typeOf(adapter[field])}`);
  }
  for (const field of Object.keys(adapter)) {
    if (field !== 'dir' && !(field in SHAPE)) problems.push(`${field}: поля нет в объявленной форме`);
  }
  return problems;
}

/** Адаптеры проекта: `[{ ...поля, dir }]`, `dir` — имя каталога адаптера в корне. */
function loadAdapters(root) {
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return []; } // корня нет — адаптеров нет
  const dirs = entries.filter((e) => e.isDirectory() && e.name.startsWith('.')).map((e) => e.name).sort();
  const found = [];
  for (const dir of dirs) {
    const file = path.join(root, dir, ADAPTER_FILE);
    if (!fs.existsSync(file)) continue;
    let mod;
    try { mod = require(file); } catch { continue; } // упал при загрузке — адаптера нет, ядро идёт дальше
    if (mod && typeof mod === 'object') found.push({ ...mod, dir });
  }
  return found;
}

/** Значение поля у первого адаптера, который его объявил; иначе `null`. */
function first(root, field) {
  for (const a of loadAdapters(root)) if (a[field] != null) return a[field];
  return null;
}

/** Значения поля-списка у всех адаптеров, склеенные. */
function all(root, field) {
  return loadAdapters(root).flatMap((a) => (Array.isArray(a[field]) ? a[field] : []));
}

/** Результаты функции-поля всех адаптеров (`fn(root)` → список), склеенные. */
function collect(root, field) {
  return loadAdapters(root).flatMap((a) => (typeof a[field] === 'function' ? a[field](root) : []));
}

/** Абсолютный путь по пути от корня проекта, записанному через `/`. */
const resolveRel = (root, rel) => path.join(root, ...rel.split('/'));

/** Абсолютный путь поля-пути первого адаптера или `null`. */
function firstPath(root, field) {
  const rel = first(root, field);
  return rel ? resolveRel(root, rel) : null;
}

module.exports = { loadAdapters, first, all, collect, firstPath, resolveRel, validateAdapter, SHAPE, UNKNOWN };
