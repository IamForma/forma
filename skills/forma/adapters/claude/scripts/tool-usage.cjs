#!/usr/bin/env node
// Сводка журнала инструментов по узлам.
// Источники: .forma/dashboard/tool-usage.log (пишет хук .claude/hooks/tool-usage.sh)
//            .claude/agents/*.md — объявленный арсенал роли, из фронтматтера, не из памяти.
//            .devtool/features/**/*.md — строки захода: `agent_id` → карточка и её эпик.
//
// Ценность сводки не в том, чем пользовались, — в том, что возили зря: объявленный
// инструмент стоит токенов на каждом шаге захода, пользовались им или нет.
//
// Три состояния журнала различаются и называются вслух (признак 3 карточки):
//   • файла нет            — хук не отработал ни разу: не зарегистрирован, не исполняем
//                            или падает до первой записи. Это ПОЛОМКА, не тишина.
//   • файл есть, строк нет — хук жив (заголовок писал он), вызовов не было.
//   • строки `!ОШИБКА`     — хук отработал, но сам сломался; причина в строке.
//
// Запуск: node .claude/scripts/tool-usage.cjs

const fs = require('fs');
const path = require('path');

// Строка расхода: канон английский, русская форма старых строк приводится
// toEnglish() до разбора (spend-line.cjs).
const { toEnglish, CALL_ID_RE, CALL_ID_UNKNOWN_RE } = require('../../.forma/dashboard/spend-line.cjs');
const { cardFiles, frontmatterBlock } = require('../../.forma/dashboard/lib/card.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const LOG = path.join(ROOT, '.forma/dashboard', 'tool-usage.log');
const AGENTS_DIR = path.join(ROOT, '.claude', 'agents');

// --- объявленный арсенал ---------------------------------------------------
// Во фронтматтере инструмент может быть записан с аргументом-шаблоном:
//   Bash(node .forma/dashboard/tally.cjs *)
// В журнале же стоит голое tool_name — «Bash». Сопоставление идёт по базовому
// имени (до скобки), а полная запись сохраняется, чтобы показать её человеку.
function baseName(decl) {
  const i = decl.indexOf('(');
  return (i === -1 ? decl : decl.slice(0, i)).trim();
}

// Каталог ролей и файл журнала — параметры со значением по умолчанию, а не константы:
// разбор нужен не только этой сводке, но и вкладке «Борт» (.forma/dashboard/generate.js),
// которой корень проекта приходит снаружи. Два разных разбора одного
// и того же журнала однажды разойдутся — и разойдутся молча, поэтому он здесь один.
function readDeclared(agentsDir = AGENTS_DIR) {
  const roles = new Map(); // name -> { file, decls: [...] }
  let files = [];
  try {
    files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
  } catch {
    return roles;
  }
  for (const f of files) {
    const text = fs.readFileSync(path.join(agentsDir, f), 'utf8');
    const fm = frontmatterBlock(text);
    if (fm === null) continue;
    const nameM = fm.match(/^name:\s*(.+)$/m);
    const toolsM = fm.match(/^tools:\s*(.+)$/m);
    const name = (nameM ? nameM[1] : path.basename(f, '.md')).trim().replace(/^["']|["']$/g, '');
    const decls = toolsM
      ? splitTools(toolsM[1].trim())
      : null; // null = поле tools отсутствует, роль наследует всё
    roles.set(name.toLowerCase(), { file: f, decls });
  }
  return roles;
}

// Разбор списка через запятую с оглядкой на скобки: `Bash(node x, y)` — один элемент.
function splitTools(line) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of line) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// --- журнал ----------------------------------------------------------------
function readLog(logFile = LOG) {
  if (!fs.existsSync(logFile)) return { alive: false, rows: [], errors: [] };
  const lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
  const rows = [];
  const errors = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const parts = s.split('·').map((p) => p.trim());
    if (parts.length < 4) {
      errors.push({ ts: '?', reason: `строка не разобрана: ${s}` });
      continue;
    }
    const [ts, node, agentId, tool] = parts;
    if (node === '!ОШИБКА') errors.push({ ts, reason: tool });
    else rows.push({ ts, node, agentId, tool });
  }
  return { alive: true, rows, errors };
}

// --- разрез по карточкам ----------------------------------------------------
// Журнал знает `agent_id` и не знает карточки; карточка знает задачу и не знает id.
// Сшивает их одно поле в строке захода:
//   `Узел`, ГГГГ-ММ-ДД: заход, N токенов (R кэш-чтение), T с, `<id вызова>` — …
// Отсюда и весь смысл разреза: снаряжают под РОД задачи, а не под узел вообще.
// Род задачи берётся из эпика карточки — это единственная общая рубрика, которая
// у карточек уже есть; выдумывать вторую ради сводки не нужно.

// Третье состояние поля (.forma/manual/en/03-forma/ECONOMY.md, «The `unknown` marker»): движок опознавателя не вернул,
// узел это НАЗВАЛ — «`id неизвестен`». Сшивать такой заход не с чем, но он существует,
// и разрез обязан назвать его отдельной величиной: иначе неизвестное неотличимо от
// «узел поленился проставить id», а пробел растворяется в разрезе без следа.
// Привязка к началу пункта списка (CALL_ID_UNKNOWN_RE) — правило: записью расхода является только
// пункт `## История`, а не цитата той же формы в прозе. Цитата обязана оставаться цитатой.

function readCardIds() {
  const byId = new Map(); // agent_id -> { card, epic, node, date }
  const unknown = [];     // заходы, где опознаватель назван неизвестным

  for (const file of cardFiles(ROOT)) {
    const f = path.basename(file);
    const text = fs.readFileSync(file, 'utf8');
    const epicM = text.match(/^epic:\s*"?([^"\n]*)"?\s*$/m);
    const epic = epicM ? epicM[1].trim() : '(без эпика)';
    for (const line of text.split(/\r?\n/)) {
      const t = toEnglish(line.trim());
      const u = CALL_ID_UNKNOWN_RE.exec(t);
      if (u) {
        unknown.push({ card: f.replace(/\.md$/, ''), epic, node: u[1], date: u[2] });
        continue;
      }
      const m = CALL_ID_RE.exec(t);
      if (!m) continue;
      byId.set(m[3], { card: f.replace(/\.md$/, ''), epic, node: m[1], date: m[2] });
    }
  }
  byId.unknownIds = unknown;
  return byId;
}

const sumCounts = (counts) => [...counts.values()].reduce((a, b) => a + b, 0);
const bump = (counts, key) => counts.set(key, (counts.get(key) || 0) + 1);

// Записи журнала → по карточкам (нашёлся `agent_id`) и «сироты» (не нашёлся).
function groupByCard(rows, byId) {
  const matched = new Map();   // card -> { epic, nodes:Set, tools:Map }
  const orphan = new Map();    // "узел · agent_id" -> Map(tool -> n)
  for (const r of rows) {
    const card = byId.get(r.agentId);
    if (card) {
      if (!matched.has(card.card)) matched.set(card.card, { epic: card.epic, nodes: new Set(), tools: new Map() });
      const e = matched.get(card.card);
      e.nodes.add(r.node);
      bump(e.tools, r.tool);
    } else {
      const key = `${r.node} · ${r.agentId}`;
      if (!orphan.has(key)) orphan.set(key, new Map());
      bump(orphan.get(key), r.tool);
    }
  }
  return { matched, orphan };
}

// Неизвестное — посчитанная величина, а не пробел: заход существует, сшить его не с чем.
function printUnknownIds(unknownIds) {
  if (!unknownIds.length) return;
  console.log(`\nопознаватель неизвестен: ${unknownIds.length} заходов (движок его не вернул, ECONOMY.md, «The unknown marker») —`);
  unknownIds.slice(0, 8).forEach((z) => console.log(`   ${z.card} · ${z.node} · ${z.date}`));
  if (unknownIds.length > 8) console.log(`   … и ещё ${unknownIds.length - 8}`);
}

function printMatched(matched) {
  if (matched.size === 0) {
    console.log('\nНи один заход журнала не сопоставлен карточке. Поле `agent_id` в строках');
    console.log('сшивать нечем. Это ожидаемое состояние, а не поломка журнала.');
    return;
  }
  const byEpic = new Map();
  for (const [card, e] of matched) {
    if (!byEpic.has(e.epic)) byEpic.set(e.epic, []);
    byEpic.get(e.epic).push([card, e]);
  }
  for (const [epic, cards] of [...byEpic.entries()].sort()) {
    console.log(`\n── род задач (эпик): ${epic}`);
    for (const [card, e] of cards.sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`   ${card} — узлы: ${[...e.nodes].sort().join(', ')}; ${sumCounts(e.tools)} вызовов`);
      [...e.tools.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .forEach(([tool, n]) => console.log(`     ${String(n).padStart(5)} × ${tool}`));
    }
  }
}

function printOrphans(orphan) {
  if (!orphan.size) return;
  const total = [...orphan.values()].reduce((s, t) => s + sumCounts(t), 0);
  console.log(`\n── карточка не сопоставлена: ${orphan.size} заходов, ${total} вызовов`);
  console.log('   `agent_id` этих заходов не найден ни в одной истории карточек. Они не');
  console.log('   приписаны никуда и ни к какому роду задач в счёт выше не попали.');
  [...orphan.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 20)
    .forEach(([key, t]) => {
      const top = [...t.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([tool, c]) => `${tool}×${c}`).join(', ');
      console.log(`     ${key} — ${sumCounts(t)} вызовов: ${top}${t.size > 5 ? ', …' : ''}`);
    });
  if (orphan.size > 20) console.log(`     … и ещё ${orphan.size - 20} заходов`);
}

function printCardCut(rows) {
  const byId = readCardIds();
  const { matched, orphan } = groupByCard(rows, byId);

  console.log('\n\n══ Разрез по карточкам: какому роду задач какие инструменты');
  console.log('Сшивка — `agent_id`: журнал ↔ строка захода в истории карточки (AGENTS.md §3).');
  printUnknownIds(byId.unknownIds || []);
  printMatched(matched);
  printOrphans(orphan);
}

// --- сводка ----------------------------------------------------------------
function printPreamble() {
  console.log('Журнал инструментов по узлам — сводка');
  console.log('Источник: .forma/dashboard/tool-usage.log\n');
  console.log('ЖУРНАЛ ПИШЕТ ПОПЫТКИ, А НЕ УДАЧИ. Хук PreToolUse срабатывает до решения о');
  console.log('доступе, поэтому отклонённый вызов попадает в журнал наравне с исполненным:');
  console.log('счёт ниже читается как «тянулся к», а не как «применил». Проверено на себе —');
  console.log('заход Kit дал 19 вызовов Bash при разрешённом во фронтматтере только');
  console.log('Bash(claude plugin *). Для подрезки арсенала это существенно: пустая строка');
  console.log('доказывает, что инструмент лишний; ненулевая не доказывает, что он сработал.\n');
}

function printLogMissing() {
  console.log('ЖУРНАЛА НЕТ. Это не «вызовов не было» — это поломка: хук');
  console.log('.claude/hooks/tool-usage.sh не отработал ни разу (не зарегистрирован в');
  console.log('.claude/settings.json, не исполняем или падает до первой записи).');
  console.log('Файл создаёт сам хук вместе с заголовком, при первом же вызове.');
  process.exitCode = 1;
}

// Записи журнала → узел → инструмент → сколько попыток.
function countByNode(rows) {
  const byNode = new Map();
  for (const r of rows) {
    if (!byNode.has(r.node)) byNode.set(r.node, new Map());
    bump(byNode.get(r.node), r.tool);
  }
  return byNode;
}

// Честная оговорка: журнал хранит голое tool_name, поэтому две записи вида
// Bash(...) с разными аргументами для него неразличимы.
function printAmbiguity(role, usedBases) {
  const ambiguous = role.decls.filter((d) => d.includes('(') && usedBases.has(baseName(d)));
  for (const b of new Set(ambiguous.map(baseName))) {
    const sameBase = role.decls.filter((d) => baseName(d) === b);
    if (sameBase.length > 1 || sameBase[0].includes('(')) {
      console.log(`     (${b}: журнал хранит только имя инструмента, без аргументов —` +
        ` какая именно из ${sameBase.length} записей \`${b}(...)\` сработала, отсюда не видно)`);
    }
  }
}

// Объявленное против применённого: сколько возится зря.
function printDeclared(role, used) {
  if (role.decls === null) {
    console.log('   объявлено: поле tools во фронтматтере отсутствует — роль наследует');
    console.log('   весь набор сессии, вычитать не из чего.');
    return;
  }
  const usedBases = new Set([...used.keys()]);
  const unused = role.decls.filter((d) => !usedBases.has(baseName(d)));
  console.log(`   объявлено ${role.decls.length}, тянулся к ${role.decls.length - unused.length}, ` +
    `возится зря ${unused.length} (ни одной попытки — доказанно лишние):`);
  if (unused.length === 0) console.log('     — (весь объявленный арсенал в деле)');
  else unused.forEach((d) => console.log(`     · ${d}`));
  printAmbiguity(role, usedBases);
}

function printNode(node, used, role) {
  const total = sumCounts(used);
  console.log(`\n── ${node} ${role ? `(.claude/agents/${role.file})` : '(роли нет — вызовы вне узлов)'}`);
  if (total === 0) console.log('   тянулся: ни к чему — ни одной записи в журнале');
  else {
    console.log(`   тянулся к (${total} попыток, не обязательно удачных):`);
    [...used.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .forEach(([tool, n]) => console.log(`     ${String(n).padStart(5)} × ${tool}`));
  }
  if (role) printDeclared(role, used);
}

function printHookErrors(errors) {
  if (!errors.length) return;
  console.log(`\n── ПОЛОМКИ ХУКА: ${errors.length}`);
  const byReason = new Map();
  for (const e of errors) bump(byReason, e.reason);
  [...byReason.entries()].forEach(([reason, n]) => console.log(`   ${String(n).padStart(5)} × ${reason}`));
  console.log('   Хук отработал, но не смог записать обычную строку. Эти вызовы в счёт');
  console.log('   выше не попали — значит «не пользовался» по ним читать нельзя.');
  process.exitCode = 1;
}

function main() {
  const declared = readDeclared();
  const { alive, rows, errors } = readLog();

  printPreamble();
  if (!alive) { printLogMissing(); return; }
  if (rows.length === 0) {
    console.log('Записей нет. Журнал существует — значит хук жив и заголовок писал он;');
    console.log('вызовов инструментов с момента его появления не было.');
  }

  const byNode = countByNode(rows);
  // узлы: сперва те, у кого есть роль, потом сессия и незнакомые
  const nodeNames = [...new Set([...byNode.keys(), ...declared.keys()])].sort();
  for (const node of nodeNames) printNode(node, byNode.get(node) || new Map(), declared.get(node));

  if (rows.length) printCardCut(rows);
  printHookErrors(errors);
}

// Разбор отдан наружу (вкладка «Борт»), печать остаётся здесь. Запуск main() — только
// когда файл запущен напрямую: require из .forma/dashboard/generate.js ничего не печатает.
module.exports = { readDeclared, readLog, readCardIds, baseName, splitTools };

if (require.main === module) main();
