#!/usr/bin/env node
// Расход основной сессии (`Intent`) по карточке — из журналов Claude Code.
//
//   node .claude/scripts/card-session-spend.cjs <NNN> [--write] [--from ISO] [--to ISO] [--session <id>] [--idle 300]
//
// Разметка журнала основной сессии по карточкам. Событие записи — Write/Edit файла карточки,
// Bash/PowerShell-команда, пишущая в файл карточки (`.devtool/features/card-NNN-*`: sed -i, tee, `>`, Set-Content…),
// или коммит (`git commit` либо `node .forma/protocol/scripts/forma-commit.cjs`) с «Карточка NNN». Каждая запись журнала отходит карточке ближайшего
// следующего события (работа предшествует записи); отрезок после события другой карточки
// начинается с ближайшей реплики человека. Ни один ответ не делится между карточками.
// В окне суммируются ответы ассистента: дедупликация по message.id, без isSidechain
// (расход субагентов уже в карточке — их строки пишет вызывающий по `<usage>`).
// N tokens = tokens_in + cache_write + cache_read + tokens_out (economy.usageTokens); R = cache_read (как у субагентов: work = N − R).
// T — активное время: промежутки между соседними записями, каждый обрезан по --idle (сек, по умолчанию 300),
//     чтобы ожидание человека не шло в счёт.
// Без --write печатает; с --write дописывает в `## История` строку формата §3 (id вызова = id сессии).
// --from/--to задают окно вручную (UTC ISO); --session ограничивает одним журналом.
//
// Одна сессия по одной карточке — несколько строк, каждая только за новые ответы. «Уже учтено» определяет
// граница окна: точная метка `граница <ISO>` в описании после тире (spend-line.cjs, sessionWindowEnd) — время
// последней записи журнала, вошедшей в строку. Повторный запуск берёт ответы строго после наибольшей границы
// строк этой сессии в карточке; сумма N, R и T по строкам равна одному чтению всего журнала (промежуток через
// границу идёт в новую строку — записи-якоря на границе не теряются). Строка старого вида, без метки
// (накопительная, до этого правила), даёт границу по концу окна «окно ЧЧ:ММ–ЧЧ:ММ UTC» с точностью до минуты:
// конец той минуты. Ответы в ней после реального конца окна не попадут ни в старую строку, ни в новую.
// Строки с окном `--from/--to` (в описании «задано --from/--to») границу не двигают, а при ручном окне
// «уже учтено» не применяется: окно задал человек. Нового расхода нет — ничего не пишется, код выхода 0.

const fs = require('fs');
const path = require('path');
const os = require('os');
const economy = require('../../.forma/dashboard/economy.cjs');
// Адаптер Claude Code: поля `usage` движка → канонические переменные (.forma/manual/en/03-forma/ECONOMY.md).
const { claudeUsage } = require('./claude-economy.cjs');
const { formatSpendLine, sessionWindowEnd } = require('../../.forma/dashboard/spend-line.cjs');
const { makeCli } = require('../../.forma/dashboard/lib/cli.cjs');
const { cardFiles, HISTORY_HEADING_RE } = require('../../.forma/dashboard/lib/card.cjs');

const cli = makeCli();
const arg = cli.value;
const num = process.argv[2] && /^\d{1,4}$/.test(process.argv[2]) ? process.argv[2].padStart(3, '0') : null;
if (!num) { console.error('card-session-spend: нужен номер карточки, напр. 074'); process.exit(2); }
const WRITE = cli.flag('write');
const IDLE = Number(arg('idle', 300)) * 1000;
const FROM = arg('from') ? Date.parse(arg('from')) : null;
const TO = arg('to') ? Date.parse(arg('to')) : null;
const ONLY = arg('session');
const MANUAL = FROM != null || TO != null;

const root = path.resolve(__dirname, '..', '..');
const slug = root.replace(/[^A-Za-z0-9]/g, '-');
const projDir = path.join(os.homedir(), '.claude', 'projects', slug);
if (!fs.existsSync(projDir)) { console.error('нет каталога журналов: ' + projDir); process.exit(2); }

const MANUAL_MARK = 'задано --from/--to';
const LEGACY_WINDOW_RE = /окно \d{2}:\d{2}–(\d{2}):(\d{2}) UTC/;
const LINE_DAY_RE = /(\d{4}-\d{2}-\d{2}):\s*attempt,/;

const ts = (e) => Date.parse(e.timestamp);
const isHuman = (e) => e.type === 'user' && !e.isMeta && (typeof e.message?.content === 'string' ||
  (Array.isArray(e.message?.content) && e.message.content.some(c => c.type === 'text')));

/** Записи основной ветки журнала с отметкой времени. */
function readRows(file) {
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; } // оборванная строка журнала — не запись
    if (e.isSidechain || !e.timestamp) continue;
    rows.push(e);
  }
  return rows;
}

// Файл карточки в команде: путь или шаблон с номером (`.devtool/features/card-NNN-*`, в том числе `done/`).
const CARD_PATH_RE = /\.devtool[\\/]features[\\/](?:done[\\/])?card-(\d{3})[-*]/;
// Команда пишет, а не читает: правка на месте, tee, командлеты записи PowerShell, запись из скрипта.
const WRITE_CMD_RE = /\bsed\s+(?:-\w*i|--in-place)|\bperl\s+-\w*i|\btee\b|\b(?:Set|Add|Clear)-Content\b|\bOut-File\b|\b(?:write|append)FileSync\b/;
// Чтение карточки — не касание: запись — перенаправление `>`/`>>` прямо в файл карточки.
const REDIRECT_TO_CARD_RE = /(?:^|[^>&\d])>{1,2}\s*["']?[^\s"'|&;]*\.devtool[\\/]features[\\/](?:done[\\/])?card-(\d{3})[-*]/;

/** Карточка, в чей файл пишет команда Bash/PowerShell; нет записи — null. */
function shellWriteTarget(cmd) {
  const redirect = REDIRECT_TO_CARD_RE.exec(cmd);
  if (redirect) return redirect[1];
  if (!WRITE_CMD_RE.test(cmd)) return null;
  const m = CARD_PATH_RE.exec(cmd);
  return m ? m[1] : null;
}

/** Номер карточки, которой принадлежит вызов инструмента `c`; нет — null. */
function toolOwner(c) {
  const inp = c.input || {};
  const command = String(inp.command || '');
  let m = /[\\/]\.devtool[\\/]features[\\/](?:done[\\/])?card-(\d{3})-/.exec(String(inp.file_path || ''));
  if (m && /^(Write|Edit)$/.test(c.name)) return m[1];
  // Коммит: `git commit` напрямую или через `node .forma/protocol/scripts/forma-commit.cjs`; номер — в сообщении.
  if ((m = /(?:git commit|forma-commit)[\s\S]*?[Кк]арточк[аи] (\d{3})/.exec(command))) return m[1];
  if (/^(Bash|PowerShell)$/.test(c.name)) return shellWriteTarget(command);
  // Вызов субагента по карточке — работа Intent по координации этой карточки.
  if ((c.name === 'Agent' || c.name === 'Task') && (m = /card-(\d{3})(?!\d)/.exec(String(inp.prompt || '')))) return m[1];
  return null;
}

/** Чью карточку записывает запись журнала: Write/Edit или Bash/PowerShell-запись файла карточки, коммит «Карточка NNN» (git или forma-commit), вызов субагента с `card-NNN` в задании. */
function ownerOf(e) {
  if (e.type !== 'assistant' || !Array.isArray(e.message?.content)) return null;
  for (const c of e.message.content) {
    if (c.type !== 'tool_use') continue;
    const owner = toolOwner(c);
    if (owner) return owner;
  }
  return null;
}

/** Записи окна по событиям карточки: `[{ e, k }]`, k — место в журнале. */
function eventWindow(rows) {
  const ev = [];
  rows.forEach((e, i) => { const c = ownerOf(e); if (c) ev.push({ i, c }); });
  // Отрезок события — от первой реплики человека после предыдущего события до самого события:
  // разговор без записи в карточку после последнего события никому не отходит.
  const mine = new Set();
  let prev = -1;
  ev.forEach((x, n) => {
    if (x.c === num) {
      let s = prev + 1;
      if (x.c !== (ev[n - 1] || {}).c) while (s < x.i && !isHuman(rows[s])) s++;
      for (let k = s; k <= x.i; k++) mine.add(k);
    }
    prev = x.i;
  });
  return rows.map((e, k) => ({ e, k })).filter(({ k }) => mine.has(k));
}

/** Записи окна, заданного --from/--to. */
const manualWindow = (rows) => rows.map((e, k) => ({ e, k }))
  .filter(({ e }) => ts(e) >= (FROM ?? 0) && ts(e) <= (TO ?? Infinity));

/**
 * Сумма окна за записи строго позже `after` (мс; null — все). Один ответ API пишется в журнал несколькими
 * записями (по блоку на каждый вызов инструмента) с общим message.id: его расход — по первой записи, иначе два
 * параллельных вызова субагентов по разным карточкам унесли бы его дважды. Время — только внутри своих
 * отрезков (промежуток через чужой ответ не считается); промежуток к первой новой записи от записи-якоря
 * на границе идёт в новую сумму. Нечего суммировать — null.
 */
function sumWindow(rows, inWin, after) {
  const isNew = ({ e }) => after == null || ts(e) > after;
  const counted = inWin.filter(isNew);
  if (!counted.length) return null;
  const firstRow = new Map();
  rows.forEach((e, k) => { const id = e.type === 'assistant' && e.message?.id; if (id && !firstRow.has(id)) firstRow.set(id, k); });
  const s = Object.assign(economy.emptyUsage(), { active: 0, from: ts(counted[0].e), to: ts(counted[counted.length - 1].e) });
  for (const { e, k } of counted) {
    const u = e.type === 'assistant' && e.message?.usage;
    if (u && firstRow.get(e.message.id) === k) economy.addUsage(s, claudeUsage(u));
  }
  for (let i = 1; i < inWin.length; i++) if (inWin[i].k === inWin[i - 1].k + 1 && isNew(inWin[i]))
    s.active += Math.min(IDLE, Math.max(0, ts(inWin[i].e) - ts(inWin[i - 1].e)));
  return s.calls ? s : null;
}

/** `{ spend, accounted }`: расход сессии за неучтённое; `accounted` — окно есть, но всё в нём уже записано. */
function scan(file, after) {
  const rows = readRows(file);
  const inWin = MANUAL ? manualWindow(rows) : eventWindow(rows);
  if (!inWin.length) return { spend: null, accounted: false };
  const spend = sumWindow(rows, inWin, MANUAL ? null : after);
  return { spend, accounted: !spend && after != null && !MANUAL };
}

/** Граница строки расхода, мс: точная метка; у строки старого вида — конец минуты конца окна; нет — null. */
function lineBoundary(line) {
  const exact = sessionWindowEnd(line);
  if (exact != null) return exact;
  const win = LEGACY_WINDOW_RE.exec(line);
  const day = LINE_DAY_RE.exec(line);
  return win && day ? Date.parse(`${day[1]}T${win[1]}:${win[2]}:59.999Z`) : null;
}

/** До какого момента ответы сессии `id` уже записаны в карточку (наибольшая граница), мс; строк нет — null. */
function accountedUntil(cardText, id) {
  let until = null;
  for (const line of cardText.split(/\r?\n/)) {
    if (!/^-\s/.test(line) || !line.includes('`' + id + '`') || !line.includes('card-session-spend') || line.includes(MANUAL_MARK)) continue;
    const at = lineBoundary(line);
    if (at != null && (until == null || at > until)) until = at;
  }
  return until;
}

const sp = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const hm = ms => new Date(ms).toISOString().slice(11, 16);

/** Строка расхода сессии за окно `r` (описание — на языке карточки, как прежде). */
function spendLine(r) {
  const window = MANUAL ? `окно ${hm(r.from)}–${hm(r.to)} UTC (${MANUAL_MARK})` : `окно ${hm(r.from)}–${hm(r.to)} UTC`;
  const edge = MANUAL ? '' : `, граница ${new Date(r.to).toISOString()}`;
  return '- ' + formatSpendLine({ node: 'Intent', date: new Date(r.to).toISOString().slice(0, 10), tokens: economy.usageTokens(r),
    cache_read: r.cache_read, duration_s: Math.round(r.active / 1000), call_id: r.id, engine: 'claude-code', desc: '' }) +
    `расход основной сессии по журналу (card-session-spend): ${r.calls} ответов, ${window}, ` +
    `выход ${sp(r.tokens_out)}, запись в кеш ${sp(r.cache_write)}${edge}.`;
}

/** Строка `--mark-unknown`: журналы прочитаны, доли карточки в них нет — исключение §3 с пометками и причиной. */
const unknownLine = () => '- ' + formatSpendLine({ node: 'Intent', date: new Date().toISOString().slice(0, 10), tokens: null,
  cache_read: null, duration_s: 0, call_id: null, engine: 'claude-code', desc: '' }) +
  `расход основной сессии не найден (card-session-spend): в журналах ${projDir.split(/[\\/]/).pop()} ` +
  `нет записи карточки, коммита или вызова субагента по ней — журнал удалён, работа шла в другом движке или без записи в карточку.`;

/** Дописывает строки в конец `## История` карточки. */
function appendToHistory(card, text, lines) {
  const fresh = lines.filter(l => !text.includes(l.split(' — ')[0]));
  if (!fresh.length) { console.log('уже записано'); return; }
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const rows = text.split(/\r?\n/);
  const h = rows.findIndex(r => HISTORY_HEADING_RE.test(r));
  if (h < 0) { console.error('нет зоны «История»'); process.exit(1); }
  let end = rows.findIndex((r, i) => i > h && /^## /.test(r));
  if (end < 0) end = rows.length;
  while (end > h + 1 && !rows[end - 1].trim()) end--;
  rows.splice(end, 0, ...fresh);
  fs.writeFileSync(card, rows.join(nl));
  console.log(`записано в ${path.relative(root, card)}: ${fresh.length}`);
}

function main() {
  const card = cardFiles(root, (name) => name.startsWith(`card-${num}-`))[0];
  const text = card ? fs.readFileSync(card, 'utf8') : '';
  const results = [];
  const accounted = [];
  for (const f of fs.readdirSync(projDir).filter(f => f.endsWith('.jsonl'))) {
    const id = f.slice(0, -6);
    if (ONLY && !id.startsWith(ONLY)) continue;
    const until = accountedUntil(text, id);
    const { spend, accounted: done } = scan(path.join(projDir, f), until);
    if (spend) results.push({ id, ...spend });
    else if (done) accounted.push({ id, until });
  }
  if (!results.length && accounted.length) {
    const last = new Date(Math.max(...accounted.map(a => a.until))).toISOString();
    console.log(`card-${num}: нового расхода нет — ответы сессии до ${last} уже записаны`);
    return;
  }
  if (!results.length && !cli.flag('mark-unknown')) {
    console.error(`card-${num}: в журналах основной сессии касаний не найдено`);
    process.exit(1);
  }
  const lines = results.length ? results.sort((a, b) => a.from - b.from).map(spendLine) : [unknownLine()];
  console.log(lines.join('\n'));
  if (!WRITE) return;
  if (!card) { console.error(`card-${num}: файл карточки не найден`); process.exit(1); }
  appendToHistory(card, text, lines);
}

main();
