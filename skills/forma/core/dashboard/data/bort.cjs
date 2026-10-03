'use strict';

/**
 * БОРТ — что стоит на борту у каждого узла и у сессии.
 *
 * Три яруса, и они НЕ смешиваются, потому что бортов на самом деле три и правятся они в трёх разных местах:
 * арсенал узла — файлом роли, MCP-серверы — конфигурацией сессии сразу для всех узлов, пол окна — движком,
 * и нам не подчиняется. Один список на всё это предлагал бы отключить то, что отключить нельзя.
 *
 * Разбор фронтматтера и журнала НЕ повторяется здесь: он берётся у адаптера движка (`toolUsage`). Два разбора
 * одного журнала однажды разойдутся, и разойдутся молча. Зависимость необязательная; нет адаптера —
 * ярус узлов честно говорит, что источника нет.
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('../lib/card.cjs');
const engines = require('../lib/engines.cjs');
const { readStatement } = require('./cache.cjs');

// Цена одного объявленного инструмента на один шаг захода — оценка, не измерение (первый замер: ~720 токенов).
// Оценкой и называется в отображении.
const TOOL_TOKEN_COST = 720;

/**
 * ТРИ ЗНАЧЕНИЯ ВЕРДИКТА, И ТРЕТЬЕ — ГЛАВНОЕ В ЭТОМ ЭКРАНЕ.
 *
 * Журнал закрывает наглухо ровно одну сторону: ни одной попытки — инструмент возится зря. Обратное неверно
 * дважды. Во-первых, попытка не доказывает нужности: хук пишет PreToolUse, то есть «тянулся», а не «сработало».
 * Во-вторых, ОТСУТСТВИЕ ЖУРНАЛА ПО УЗЛУ НЕ ОЗНАЧАЕТ, ЧТО ЕГО ИНСТРУМЕНТЫ ЛИШНИЕ: узла, которого в журнале
 * нет вовсе, пустая строка и не-заведённая строка на вид одинаковы, и экран, выдавший арсенал за мёртвый,
 * предложил бы срезать нужное.
 *
 * Различие проведено ПО УЗЛУ, а не по инструменту:
 *   • журнала нет вовсе (файла нет / записей нет)          → всё «не знаем»
 *   • журнал есть, но по ЭТОМУ узлу нет ни одной строки    → всё «не знаем»
 *   • по этому узлу строки есть, у инструмента попыток 0   → «доказанно лишний»
 *   • попытки есть                                          → «в деле»
 */
function verdictFor(calls, nodeInLog) {
  if (!nodeInLog) return 'unknown';
  return calls > 0 ? 'live' : 'dead';
}

// ---- MCP-серверы --------------------------------------------------------------------------------

function mcpServerRow(name, cfg, meta) {
  return {
    name,
    source: meta.rel,
    level: meta.level,
    transport: cfg.type || (cfg.command ? 'stdio' : 'неизвестен'),
    target: cfg.url || [cfg.command, ...(cfg.args || [])].filter(Boolean).join(' ') || null,
    broken: false,
  };
}

/**
 * MCP-СЕРВЕРЫ ЧИТАЮТСЯ С ДВУХ УРОВНЕЙ, И ТРЕТЬЕГО ЭТОТ КОД НЕ ВИДИТ ВОВСЕ.
 *
 * Уровней конфигурации на диске два: проектный и пользовательский (ключ `mcpServers` верхнего уровня);
 * файлы называет адаптер движка (`mcpConfigs`). Первый ездит с репозиторием, второй — с человеком; у каждого
 * сервера сказано, откуда он взялся. Сверх этих двух сессия несёт коннекторы уровня учётной записи и серверы
 * плагинов: ни в одном локальном файле их нет, прочитать их отсюда НЕЛЬЗЯ — и молчать об этом нельзя тем более.
 * Поэтому `scanned` возвращает пройденные уровни, а отображение обязано назвать непрочитываемый словами.
 */
function readMcpConfigs(projectRoot) {
  const servers = [];
  const scanned = [];
  for (const { rel, file, level } of engines.collect(projectRoot, 'mcpConfigs')) {
    // Файла может не быть — это не ошибка, это «на этом уровне не объявлено».
    if (!fs.existsSync(file)) { scanned.push({ source: rel, level, exists: false, broken: false, count: 0 }); continue; }
    let d;
    try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {
      servers.push({ name: null, source: rel, level, broken: true });
      scanned.push({ source: rel, level, exists: true, broken: true, count: 0 });
      continue;
    }
    const entries = Object.entries(d.mcpServers || {});
    for (const [name, cfg] of entries) servers.push(mcpServerRow(name, cfg, { rel, level }));
    scanned.push({ source: rel, level, exists: true, broken: false, count: entries.length });
  }
  return { servers, scanned };
}

/**
 * Ярус сессии, вторая половина: на какие серверы ссылаются роли. Имя сервера — из `mcp__<сервер>__<инструмент>`.
 * Сервера нет в конфигурации проекта — это НЕ «не авторизован»: он может приезжать из глобального конфига
 * или плагина. Третье значение и здесь, по той же причине, что и в вердикте.
 */
function referencedServers(nodes, servers) {
  const configured = new Set(servers.map((s) => s.name).filter(Boolean));
  const refMap = new Map();
  for (const n of nodes) {
    for (const t of n.tools || []) {
      const p = t.base.split('__');
      if (p.length < 3 || p[0] !== 'mcp') continue;
      const server = p[1];
      if (!refMap.has(server)) refMap.set(server, { server, nodes: [], toolCount: 0, inProjectConfig: configured.has(server) });
      const e = refMap.get(server);
      if (!e.nodes.includes(n.node)) e.nodes.push(n.node);
      e.toolCount += 1;
    }
  }
  return [...refMap.values()].sort((a, b) => a.server.localeCompare(b.server));
}

// ---- узлы ---------------------------------------------------------------------------------------

/** Пол окна — читается из кэша, не считается здесь; считает `node .forma/dashboard/floor.cjs`. */
const readFloor = (projectRoot) => readStatement(projectRoot, 'floor.json', ['cache', 'sessions']);

/** Попытки по узлам. Ключ — имя узла в нижнем регистре, как в журнале и во фронтматтере. */
function callsByNode(rows) {
  const byNode = new Map();
  for (const r of rows) {
    const k = r.node.toLowerCase();
    if (!byNode.has(k)) byNode.set(k, new Map());
    const t = byNode.get(k);
    t.set(r.tool, (t.get(r.tool) || 0) + 1);
  }
  return byNode;
}

const sumCalls = (used) => [...used.values()].reduce((a, b) => a + b, 0);

function toolRows(role, used, ctx) {
  return role.decls.map((decl) => {
    const base = ctx.toolUsage.baseName(decl);
    const calls = used.get(base) || 0;
    // Журнал хранит голое tool_name без аргументов: две записи `Bash(...)` с разными шаблонами для него
    // неразличимы — попытки по ним не делятся, а дублируются. Помечается, а не заминается.
    const sameBase = role.decls.filter((d) => ctx.toolUsage.baseName(d) === base).length;
    return { decl, base, calls, ambiguous: sameBase > 1 && calls > 0, verdict: verdictFor(calls, ctx.nodeInLog) };
  });
}

/**
 * Тянулись, но во фронтматтере не объявлено (`SubagentHandback` и прочие неявные). Не входит ни в вес,
 * ни в вердикты: подрезать нечего, это не наш арсенал.
 */
function undeclaredOf(used, role, toolUsage) {
  const bases = new Set(role.decls.map(toolUsage.baseName));
  return [...used.entries()]
    .filter(([tool]) => !bases.has(tool))
    .map(([tool, calls]) => ({ tool, calls }))
    .sort((a, b) => b.calls - a.calls);
}

function declaredRow(head, role, ctx) {
  const used = ctx.byNodeTools.get(head.node) || new Map();
  const tools = toolRows(role, used, ctx);
  const undeclared = undeclaredOf(used, role, ctx.toolUsage);
  const counts = { live: 0, dead: 0, unknown: 0 };
  for (const t of tools) counts[t.verdict] += 1;
  return {
    ...head,
    inherits: false, nodeInLog: ctx.nodeInLog,
    calls: sumCalls(used),
    tools,
    toolCount: tools.length,
    weightTokens: tools.length * TOOL_TOKEN_COST,
    counts,
    deadWeight: counts.dead * TOOL_TOKEN_COST,
    undeclared,
  };
}

/**
 * Роль без поля `tools` наследует весь набор сессии. Вычитать не из чего, и выдавать это за «инструментов ноль»
 * нельзя: их, наоборот, максимум.
 */
function inheritingRow(head, ctx) {
  const used = ctx.byNodeTools.get(head.node) || new Map();
  return {
    ...head,
    inherits: true, nodeInLog: ctx.nodeInLog,
    calls: sumCalls(used),
    tools: [], toolCount: null, weightTokens: null,
    counts: { live: 0, dead: 0, unknown: 0 }, deadWeight: 0, undeclared: [],
  };
}

function nodeRow([name, role], ctx) {
  const fm = parseFrontmatter(fs.readFileSync(path.join(ctx.rolesDir, role.file), 'utf8'));
  const head = { node: name, file: role.file, model: fm.model || null, effort: fm.effort || null };
  // Узел ЕСТЬ в журнале, если журнал вообще жив И по этому узлу в нём заведена хотя бы одна строка.
  // Ноль строк — не ноль попыток.
  const nodeCtx = { ...ctx, nodeInLog: ctx.logUsable && ctx.byNodeTools.has(name) };
  return role.decls === null ? inheritingRow(head, nodeCtx) : declaredRow(head, role, nodeCtx);
}

function bortTotals(nodes) {
  const counted = nodes.filter((n) => !n.inherits);
  const total = (f) => counted.reduce((s, n) => s + f(n), 0);
  return {
    nodeCount: nodes.length,
    toolCount: total((n) => n.toolCount),
    weightTokens: total((n) => n.weightTokens),
    live: total((n) => n.counts.live),
    dead: total((n) => n.counts.dead),
    unknown: total((n) => n.counts.unknown),
    deadWeight: total((n) => n.deadWeight),
    nodesInLog: counted.filter((n) => n.nodeInLog).length,
  };
}

function logSummary(logData, logUsable, byNodeTools) {
  return {
    alive: logData.alive,
    usable: logUsable,
    rowCount: logData.rows.length,
    errorCount: logData.errors.length,
    // Узлы, про которые журнал вообще что-то знает, — включая те, у кого нет роли (`сессия`). Нужны
    // отображению, чтобы назвать охват журнала числом, а не словом.
    nodesSeen: [...byNodeTools.keys()].sort(),
  };
}

function buildBort(projectRoot) {
  const floor = readFloor(projectRoot);
  const { servers, scanned: mcpScanned } = readMcpConfigs(projectRoot);
  const toolUsage = engines.first(projectRoot, 'toolUsage');
  const rolesDir = engines.firstPath(projectRoot, 'rolesDir');

  if (!toolUsage || !rolesDir) {
    // Ярус узлов построить не на чем — и это сказано вслух (`source: null`), а не молча пусто.
    return { source: null, log: null, nodes: [], totals: null, servers, mcpScanned, referenced: [], floor, toolTokenCost: TOOL_TOKEN_COST };
  }

  const declared = toolUsage.readDeclared(rolesDir);
  const logData = toolUsage.readLog(path.join(projectRoot, '.forma/dashboard', 'tool-usage.log'));
  const byNodeTools = callsByNode(logData.rows);
  const logUsable = logData.alive && logData.rows.length > 0;
  const ctx = { toolUsage, rolesDir, byNodeTools, logUsable };
  const nodes = [...declared.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
    .map((entry) => nodeRow(entry, ctx));

  return {
    source: toolUsage.source,
    log: logSummary(logData, logUsable, byNodeTools),
    nodes,
    totals: bortTotals(nodes),
    servers,
    mcpScanned,
    referenced: referencedServers(nodes, servers),
    floor,
    toolTokenCost: TOOL_TOKEN_COST,
  };
}

module.exports = { buildBort };
