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
 *   id                     имя движка для `check <engine>`, строка         имя каталога без точки
 *   spendTag               метка движка в строке расхода §3 после тире     значение `engine`
 *   sources                { rolesDir, onDemandRolesDir, runRolesDir,      значения по соглашению
 *                          scriptsDir, skillsDir, testsDir (строки),       от каталога адаптера
 *                          packageManifest (строка), mcpConfigs (список) } (`sourcesOf`)
 *   capabilities           { subagents, sendMessage, hooks, mcp } —        режим «деградированный»
 *                          булевы; subagents: true даёт режим «полный»     (`modeOf`)
 *   nodeModels             { Узел: { model, effort } } для пяти узлов      таблицы нет
 *   writeZones             список путей, куда движок пишет: своя папка и   пишет только в свою папку
 *                          карточки (.devtool/features)                    (проверка `check`)
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
  usageRefresh: 'array',
  mcpConfigs: 'function',
  engineSettings: 'function',
  formaRoles: 'function',
  structure: 'object',
  id: 'string',
  spendTag: 'string',
  sources: 'object',
  capabilities: 'object',
  nodeModels: 'object',
  writeZones: 'array',
};

/** Поля `sources` и тип каждого. */
const SOURCE_FIELDS = {
  rolesDir: 'string',
  onDemandRolesDir: 'string',
  runRolesDir: 'string',
  scriptsDir: 'string',
  skillsDir: 'string',
  testsDir: 'string',
  packageManifest: 'string',
  mcpConfigs: 'array',
};
/** Возможности движка: каждая — булево. */
const CAPABILITY_FIELDS = ['subagents', 'sendMessage', 'hooks', 'mcp'];
/** Пять узлов таблицы `nodeModels`. */
const NODES = ['Intent', 'Spec', 'Kit', 'Run', 'Core'];
const MODE_FULL = 'полный';
const MODE_DEGRADED = 'деградированный';
/** Карточки — вторая разрешённая зона записи, кроме собственной папки движка. */
const CARDS_ZONE = '.devtool/features';

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
  const { sources, capabilities, nodeModels, writeZones } = adapter;
  if (typeOf(sources) === 'object') {
    for (const [k, v] of Object.entries(sources)) {
      if (!(k in SOURCE_FIELDS)) problems.push(`sources.${k}: поля нет в объявленной форме`);
      else if (typeOf(v) !== SOURCE_FIELDS[k]) problems.push(`sources.${k}: ждали ${SOURCE_FIELDS[k]}, пришло ${typeOf(v)}`);
      else if (k === 'mcpConfigs' && v.some((x) => typeof x !== 'string')) problems.push('sources.mcpConfigs: ждали список строк');
    }
  }
  if (typeOf(capabilities) === 'object') {
    for (const [k, v] of Object.entries(capabilities)) {
      if (!CAPABILITY_FIELDS.includes(k)) problems.push(`capabilities.${k}: поля нет в объявленной форме`);
      else if (typeof v !== 'boolean') problems.push(`capabilities.${k}: ждали boolean, пришло ${typeOf(v)}`);
    }
  }
  if (typeOf(nodeModels) === 'object') {
    for (const [node, row] of Object.entries(nodeModels)) {
      if (!NODES.includes(node)) problems.push(`nodeModels.${node}: узла нет среди пяти`);
      else if (typeOf(row) !== 'object' || typeof row.model !== 'string' || typeof row.effort !== 'string') problems.push(`nodeModels.${node}: ждали { model, effort } строками`);
    }
  }
  if (Array.isArray(writeZones) && writeZones.some((x) => typeof x !== 'string')) problems.push('writeZones: ждали список строк');
  return problems;
}

/** Имя движка: `id` или имя каталога адаптера без точки. */
function idOf(adapter) {
  if (adapter && typeof adapter.id === 'string' && adapter.id) return adapter.id;
  return adapter && adapter.dir ? String(adapter.dir).replace(/^\./, '') : UNKNOWN;
}

/**
 * Источники адаптера: объявленные в `sources` как есть; адаптер без `sources` — значения по соглашению
 * от его каталога (`<каталог>/agents`, `/agents/on-demand`, `/agents/run`, `/scripts`, `/skills`, `/tests`);
 * `packageManifest` по соглашению — `null`, `mcpConfigs` — пустой список. Объявленное соглашением не затирается.
 */
function sourcesOf(adapter) {
  const dir = adapter && adapter.dir ? String(adapter.dir) : '.' + idOf(adapter);
  const byConvention = {
    rolesDir: `${dir}/agents`,
    onDemandRolesDir: `${dir}/agents/on-demand`,
    runRolesDir: `${dir}/agents/run`,
    scriptsDir: `${dir}/scripts`,
    skillsDir: `${dir}/skills`,
    testsDir: `${dir}/tests`,
    packageManifest: null,
    mcpConfigs: [],
  };
  const declared = adapter && adapter.sources && typeof adapter.sources === 'object' ? adapter.sources : null;
  return declared ? { ...byConvention, ...declared } : byConvention;
}

/** Режим движка (AGENTS.md §2): «полный», если объявлен вызов субагентов, иначе «деградированный». */
function modeOf(adapter) {
  const c = adapter && adapter.capabilities;
  return c && typeof c === 'object' && c.subagents === true ? MODE_FULL : MODE_DEGRADED;
}

const under = (rel, dir) => rel === dir || rel.startsWith(dir + '/');

/**
 * Пункты контракта для адаптера: `[{ item, ok, detail }]`. Читает диск только для существования объявленных источников.
 * Движок пишет только в свою папку и карточки; Kit создаёт роли в rolesDir движка, который их исполняет.
 */
function checkAdapter(adapter, root) {
  const out = [];
  const add = (item, ok, detail = '') => out.push({ item, ok: Boolean(ok), detail });
  const shape = validateAdapter(adapter);
  add('форма адаптера соблюдена', shape.length === 0, shape.join('; '));
  add('метка расхода (spendTag или engine)', typeof (adapter.spendTag || adapter.engine) === 'string', 'ни spendTag, ни engine не объявлены');
  const src = sourcesOf(adapter);
  add('sources объявлены', adapter.sources != null, 'поле sources не объявлено, действует соглашение');
  for (const k of ['rolesDir', 'onDemandRolesDir', 'runRolesDir', 'scriptsDir', 'skillsDir', 'testsDir', 'packageManifest']) {
    if (adapter.sources == null || adapter.sources[k] == null) continue;
    add(`sources.${k} существует`, fs.existsSync(resolveRel(root, src[k])), src[k]);
  }
  const cap = adapter.capabilities;
  const capOk = cap && typeof cap === 'object' && CAPABILITY_FIELDS.every((k) => typeof cap[k] === 'boolean');
  add('capabilities объявлены (subagents, sendMessage, hooks, mcp)', capOk, 'нужны четыре булевых поля');
  add(`режим движка: ${modeOf(adapter)}`, true);
  const nm = adapter.nodeModels;
  add('nodeModels: пять узлов с моделью и усилием', nm && typeof nm === 'object' && NODES.every((n) => nm[n] && nm[n].model && nm[n].effort),
    'нужны Intent, Spec, Kit, Run, Core');
  const zones = adapter.writeZones;
  const own = adapter.dir ? String(adapter.dir) : null;
  const zonesOk = Array.isArray(zones) && zones.length > 0 && zones.every((z) => (own && under(z, own)) || under(z, CARDS_ZONE));
  add('writeZones: только своя папка и карточки', zonesOk, `разрешены ${own || 'папка движка'} и ${CARDS_ZONE}`);
  add('rolesDir внутри зоны записи движка', own != null && under(src.rolesDir, own), `${src.rolesDir} вне ${own}`);
  // Проба разбора: шаг с выходными токенами в частых именах поля, плоский и под usage; ждём tokens_out = 7.
  const flat = { tokens_out: 7, output_tokens: 7, outputTokens: 7, completion_tokens: 7, candidatesTokenCount: 7 };
  const reads = (step) => { try { const r = adapter.parseUsage(step); return Boolean(r) && typeof r === 'object' && r.tokens_out === 7; } catch { return false; } };
  add('parseUsage отдаёт tokens_out', typeof adapter.parseUsage === 'function' && (reads(flat) || reads({ usage: flat })), 'шаг с 7 выходными токенами не дал tokens_out = 7');
  return out;
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

/**
 * Метки движков в строке расхода: `spendTag`, `engine` и `id` каждого адаптера (строка может нести любую из них).
 * Нет ни одного адаптера — пустой список (метку судить не по чему).
 */
function spendTags(root) {
  const tags = new Set();
  for (const a of loadAdapters(root)) {
    for (const v of [a.spendTag, a.engine, idOf(a)]) if (typeof v === 'string' && v && v !== UNKNOWN) tags.add(v);
  }
  return [...tags];
}

/**
 * Движки проекта по адаптерам: `[{ tag, aliases }]`. `tag` — основная метка (`spendTag`, иначе `engine`), `aliases` — все
 * метки, под которыми движок может стоять в строке расхода (`spendTag`, `engine`, `id`). Вкладка и колонка расхода
 * строятся от этого списка: появилась папка движка с адаптером — движок в списке, удалена — нет.
 */
function engineTags(root) {
  return loadAdapters(root).map((a) => {
    const tag = a.spendTag || a.engine || idOf(a);
    const aliases = [...new Set([a.spendTag, a.engine, idOf(a)].filter((v) => typeof v === 'string' && v && v !== UNKNOWN))];
    return { tag, aliases: aliases.includes(tag) ? aliases : [tag, ...aliases] };
  });
}

/**
 * Каталоги стенограмм всех адаптеров: `[{ tag, dir, parseUsage }]`, `tag` — метка движка (`spendTag` или `engine`).
 * Адаптер без `transcriptsDir`, бросивший или не нашедший каталог — пропускается.
 */
function transcriptDirs(root) {
  const out = [];
  for (const a of loadAdapters(root)) {
    if (typeof a.transcriptsDir !== 'function') continue;
    let dir = null;
    try { dir = a.transcriptsDir(root); } catch { dir = null; }
    if (!dir || !fs.existsSync(dir)) continue;
    out.push({ tag: a.spendTag || a.engine || idOf(a), dir, parseUsage: typeof a.parseUsage === 'function' ? a.parseUsage : null });
  }
  return out;
}

/** Таблица узел -> { model, effort } каждого адаптера: `[{ tag, dir, nodeModels }]` (адаптеры без таблицы пропускаются). */
function nodeModelTables(root) {
  return loadAdapters(root)
    .filter((a) => a.nodeModels && typeof a.nodeModels === 'object')
    .map((a) => ({ tag: a.spendTag || a.engine || idOf(a), dir: a.dir, nodeModels: a.nodeModels }));
}

/** Абсолютный путь по пути от корня проекта, записанному через `/`. */
const resolveRel = (root, rel) => path.join(root, ...rel.split('/'));

/** Абсолютный путь поля-пути первого адаптера или `null`. */
function firstPath(root, field) {
  const rel = first(root, field);
  return rel ? resolveRel(root, rel) : null;
}

module.exports = {
  loadAdapters, first, all, collect, firstPath, engineTags, spendTags, transcriptDirs, nodeModelTables, resolveRel, validateAdapter, SHAPE, UNKNOWN,
  idOf, sourcesOf, modeOf, checkAdapter, MODE_FULL, MODE_DEGRADED,
};

/**
 * `node engines.cjs check <engine> [--root <dir>]` — печатает пункты контракта: `✓` пройден, `✗` не пройден.
 * Код выхода: 0 — все пройдены, 1 — есть непройденный, 2 — нет движка или неверный вызов. Ничего не пишет.
 */
if (require.main === module) {
  const argv = process.argv.slice(2);
  const ri = argv.indexOf('--root');
  const root = ri >= 0 ? path.resolve(argv[ri + 1] || '.') : process.cwd();
  const rest = argv.filter((a, i) => a !== '--root' && (ri < 0 || i !== ri + 1));
  if (rest[0] !== 'check' || !rest[1]) {
    console.error('usage: node .forma/dashboard/lib/engines.cjs check <engine> [--root <dir>]');
    process.exit(2);
  }
  const a = loadAdapters(root).find((x) => idOf(x) === rest[1] || x.engine === rest[1] || x.dir === rest[1]);
  if (!a) {
    console.error(`engine not found: ${rest[1]} (adapters: ${loadAdapters(root).map(idOf).join(', ') || 'none'})`);
    process.exit(2);
  }
  const items = checkAdapter(a, root);
  for (const r of items) console.log(`${r.ok ? '✓' : '✗'} ${r.item}${!r.ok && r.detail ? ' — ' + r.detail : ''}`);
  const failed = items.filter((r) => !r.ok).length;
  console.log(`${idOf(a)}: passed ${items.length - failed}, failed ${failed}`);
  process.exit(failed ? 1 : 0);
}
