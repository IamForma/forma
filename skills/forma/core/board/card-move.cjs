#!/usr/bin/env node
// Передача карточки следующему узлу одним вызовом: status + assignee + строка этапа + проверка доски (AGENTS.md §6–7).
//
//   node .forma/board/card-move.cjs <card> --to kit|run|intent|accept|close --note "<что сделано>" [--node <узел>] [--dry]
//                                 [--duration-ms MS --agent-id <id> [--tokens N] [--cache-read R] [--turns K] [--engine <тег движка>]]
//                                 [--kit "<текст>"|-] [--result "<текст>"|-] [--session-spend <NNN>]
//
// <card>  — «NNN» или «card-NNN»; карточка живая (в done/ — уже закрыта, передавать нечего).
// --to    — куда передаём; таблица §7 → поля frontmatter, ключ этапа §6:
//             kit     todo        Kit      stage kit      пишет Intent: открыл цикл, карточка в комплектацию
//             run     in-progress Run      stage exec     пишет Kit: комплект готов, исполнение
//             intent  review      Intent   stage check     пишет тот, кто исполнял: результат на проверку
//             accept  review      Intent   stage accept    пишет Intent: проверка пройдена, ждёт «да» человека
//             close   done        Core     stage close    пишет Intent: человек принял; файл уходит в done/
//           Кто держит `run`, задаёт метка `route-N` карточки (§6–7): `route-4` (короткий маршрут) — исполняет Kit, `run`
//           держит "Kit"; `route-0` и `route-1` — исполняет Intent, `run` держит "Intent"; остальные маршруты — Run.
// --note  — «что» в строке этапа; без него — ошибка: пустая строка этапа ничего не говорит.
// --node  — чья строка; по умолчанию узел, который делает эту передачу (см. таблицу; для `intent` — прежний исполнитель).
// Расход (AGENTS.md §3, ECONOMY.md) — вызывающий пишет его сразу после возврата узла; тот же вызов дописывает и строку расхода:
//           --duration-ms MS (секунды округляются), --agent-id <id вызова>; нужны оба. N, R и O читаются из стенограммы вызова
//           (как `claude-economy.cjs line`); --tokens N — запасное значение: с ним строка пишется как есть, без чтения стенограммы.
//           Стенограммы нет и --tokens нет — N, R и O = unknown с причиной в описании, не ноль.
//           --cache-read R — иначе «(cache-read unknown)» с причиной в описании; --turns K — «K turns»; --engine — тег движка; без него — движок, чьи стенограммы свежее всех (адаптеры), иначе единственный адаптер.
//           Строка расхода идёт от узла `--node` (того, чей вызов вернулся), перед строкой этапа. Без этих флагов расход не пишется.
// Секции карточки — тем же вызовом, без отдельной правки файла:
//           --kit    — тело зоны «Комплект» (шесть единиц, AGENTS.md §6); только с --to run: Kit записывает комплект при передаче.
//           --result — тело зоны «Результат»; только с --to intent: исполнитель записывает итог при возврате на проверку.
//           Значение «-» читает текст из stdin (многострочный текст — через heredoc); иначе берётся сам аргумент. Тело зоны заменяется
//           целиком (при правке комплекта после возврата — новый комплект, а не дописывание). Только одно из двух может быть «-».
//           --session-spend NNN — только с --to accept|close: тем же вызовом дописывает строку расхода `Intent` по карточке
//           (вывод `card-session-spend.cjs NNN --write` адаптера движка, строка перед строкой этапа); NNN — номер этой же карточки.
//           Скрипта у адаптеров нет или он ничего не дал — ошибка до любой записи. Нового расхода нет — строка не пишется, это не ошибка.
// Закрытие круга: node .forma/board/card-move.cjs --to core-close <NNN…> --note "<основание>" [--dry] — пишет `Core`: на каждой названной
//           карточке (done, assignee "Core") строка «закрыто — <основание>» в «История» и assignee: null; остальное не меняется.
//           Неизвестный номер, повтор или карточка не в done/Core — стоп до любой записи. Флаги расхода и секций здесь не принимаются.
// --dry   — показать изменения, файл не писать.
// Пишет `modified` (на `close` — и `completedAt`), дописывает строку в «История», затем проверяет доску по этой карточке.
// Часть ядра: одна для всех движков, путей движка не знает.

const fs = require('fs');
const path = require('path');
const { makeCli } = require('../dashboard/lib/cli.cjs');
const { cardFiles, parseFrontmatter, frontmatterBlock, zoneHeadingIn, labelsOf } = require('../dashboard/lib/card.cjs');
const { normalize } = require('./run-in-card.cjs');
const { checkBoard } = require('./check-board.cjs');
const i18n = require('../i18n/index.cjs');
const { projectFile } = require('../dashboard/lib/fs.cjs');
const { formatSpendLine } = require('../dashboard/spend-line.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const BOARD = path.join(ROOT, '.devtool', 'features');

const cli = makeCli();
const { arg, flag } = cli;
const die = cli.die('card-move');

const TARGETS = {
  kit: { status: 'todo', assignee: 'Kit', stage: 'kit', by: 'Intent' },
  run: { status: 'in-progress', assignee: 'Run', stage: 'exec', by: 'Kit' },
  intent: { status: 'review', assignee: 'Intent', stage: 'check', by: 'Run' },
  accept: { status: 'review', assignee: 'Intent', stage: 'accept', by: 'Intent' },
  close: { status: 'done', assignee: 'Core', stage: 'close', by: 'Intent' },
};

const id = normalize(cli.positional()[0]);
const to = arg('to');
const note = arg('note');

// Закрытие круга (`Core`): --to core-close <NNN…> --note "<основание>" — на каждой названной карточке строка «закрыто — …» и assignee: null.
// Карточки уже в done/ с assignee "Core"; статус и прочие поля не меняются. Любой неверный номер — стоп до первой записи.
if (to === 'core-close') {
  const words = [];
  for (let i = 0; i < cli.argv.length; i++) {
    if (cli.argv[i] === '--dry') continue;
    if (cli.argv[i].startsWith('--')) { i++; continue; }
    words.push(cli.argv[i]);
  }
  const ids = words.map(normalize);
  if (!ids.length || ids.some((x) => !x)) die('core-close: нужны номера карточек — --to core-close NNN [NNN…] --note "<основание>"');
  if (!note || /[\n]/.test(note)) die('нужен --note "<основание>" в одну строку');
  if (['kit', 'result', 'session-spend', 'tokens', 'duration-ms', 'agent-id'].some((k) => process.argv.includes('--' + k))) die('core-close: другие флаги расхода и секций не принимаются');
  const day0 = new Date().toISOString().slice(0, 10);
  const plan = [];
  for (const cid of ids) {
    const fs0 = cardFiles(ROOT, (n) => n.startsWith(cid + '-') && n.endsWith('.md'));
    if (!fs0.length) die(`карточки ${cid} нет на доске — ничего не записано`);
    if (plan.some((p) => p.cid === path.basename(fs0[0], '.md'))) die(`${cid} назван дважды — ничего не записано`);
    const f0 = fs0[0];
    const cid0 = path.basename(f0, '.md');
    let tx = fs.readFileSync(f0, 'utf8');
    const fm0 = parseFrontmatter(tx);
    if (fm0.status !== 'done' || fm0.assignee !== 'Core') die(`${cid0}: нужны status "done" и assignee "Core" (сейчас ${fm0.status}/${fm0.assignee}) — ничего не записано`);
    const zh = zoneHeadingIn(tx, 'history');
    if (!zh) die(`${cid0}: нет зоны «История» — ничего не записано`);
    const hAt = tx.indexOf('\n## ' + zh);
    const zr = zoneHeadingIn(tx, 'result');
    const rAt = zr ? tx.indexOf('\n## ' + zr, hAt + 1) : -1;
    const hEnd = rAt === -1 ? tx.length : rAt;
    const hb = tx.slice(hAt, hEnd).replace(/\s*$/, '');
    tx = tx.slice(0, hAt) + hb + '\n- `Core`, ' + day0 + ': closed — ' + note.replace(/\.?\s*$/, '.') + '\n' + (rAt === -1 ? '' : tx.slice(rAt));
    if (!/^assignee:.*$/m.test(tx)) die(`${cid0}: в frontmatter нет поля assignee — ничего не записано`);
    tx = tx.replace(/^assignee:.*$/m, 'assignee: null');
    plan.push({ cid: cid0, file: f0, text: tx, before: fs.readFileSync(f0, 'utf8') });
  }
  if (flag('dry')) { for (const p of plan) console.log(path.relative(ROOT, p.file).replace(/\\/g, '/') + '\n' + p.text); process.exit(0); }
  for (const p of plan) fs.writeFileSync(p.file, p.text);
  const bad = checkBoard(ROOT).filter((p) => plan.some((q) => p.includes(q.cid)));
  for (const p of plan) console.log(`ok: ${p.cid} → done/null · закрыто`);
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
  process.exit(0);
}

if (!id || !to) die(`нужны <card> и --to ${Object.keys(TARGETS).join('|')}`);
if (!TARGETS[to]) die(`--to "${to}" — нет такого перехода (${Object.keys(TARGETS).join('|')})`);
if (!note || /[\n]/.test(note)) die('нужен --note "<что сделано>" в одну строку');
const t = TARGETS[to];


/** Тег движка по умолчанию: адаптер с самой свежей стенограммой; иначе единственный адаптер; иначе пусто (нужен --engine). */
function activeEngineTag() {
  const E = require('../dashboard/lib/engines.cjs');
  const newest = (dir, depth) => {
    let t = 0;
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isFile()) t = Math.max(t, fs.statSync(f).mtimeMs);
        else if (e.isDirectory() && depth > 0) t = Math.max(t, newest(f, depth - 1));
      }
    } catch {}
    return t;
  };
  let best = null;
  for (const d of E.transcriptDirs(ROOT)) {
    const t = newest(d.dir, 2);
    if (t && (!best || t > best.t)) best = { t, tag: d.tag };
  }
  if (best) return best.tag;
  const tags = E.engineTags(ROOT);
  return tags.length === 1 ? tags[0].tag : '';
}

// Расход: --duration-ms и --agent-id обязательны; --tokens — запасное значение, если стенограммы вызова нет
const tokens = arg('tokens'), durationMs = arg('duration-ms'), agentId = arg('agent-id');
const cacheRead = arg('cache-read'), turns = arg('turns'), engine = arg('engine') || activeEngineTag();
const spendGiven = [tokens, durationMs, agentId].some((v) => v != null);
if (spendGiven) {
  if (durationMs == null || agentId == null) die('расход: нужны --duration-ms и --agent-id (--tokens — запасное значение, без него N читается из стенограммы)');
  const num = { ...(tokens != null && { tokens }), 'duration-ms': durationMs, ...(cacheRead != null && { 'cache-read': cacheRead }), ...(turns != null && { turns }) };
  for (const [k, v] of Object.entries(num)) if (!/^\d+$/.test(v)) die(`--${k} "${v}" — нужно целое число`);
  if (!/^[\w.:-]+$/.test(agentId)) die(`--agent-id "${agentId}" — не похоже на id вызова`);
  if (!engine) die('не удалось определить движок по адаптерам: передайте --engine <тег>');
  if (!/^[a-z][\w-]*$/.test(engine)) die(`--engine "${engine}" — не тег движка`);
}
// Без --tokens N, R и O читаются из стенограммы вызова: каталог и разбор шага даёт адаптер того движка, чей тег в строке
// (`transcriptDirs`: tag, dir, parseUsage); только чтение. Шаги одной записи дедуплицируются по requestId (иначе завышение).
// Стенограммы нет — N, R и O остаются unknown с причиной в описании, не ноль.
function readTranscript(agentId, tag) {
  const E = require('../dashboard/lib/engines.cjs');
  const d = E.transcriptDirs(ROOT).find((x) => x.tag === tag && typeof x.parseUsage === 'function');
  if (!d || !/^[A-Za-z0-9_-]+$/.test(agentId)) return null;
  let file = null, mt = 0;
  try {
    for (const s of fs.readdirSync(d.dir, { withFileTypes: true })) {
      if (!s.isDirectory()) continue;
      const f = path.join(d.dir, s.name, 'subagents', `agent-${agentId}.jsonl`);
      try { const m = fs.statSync(f).mtimeMs; if (m > mt) { mt = m; file = f; } } catch {}
    }
  } catch { return null; }
  if (!file) return null;
  const seen = new Set(), sum = { in: 0, write: 0, read: 0, out: 0 };
  let steps = 0;
  for (const ln of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!ln.includes('cache_read_input_tokens')) continue;
    let j; try { j = JSON.parse(ln); } catch { continue; }
    const u = j.message && j.message.usage;
    if (!u || u.cache_read_input_tokens == null) continue;
    const key = j.requestId || j.uuid;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = d.parseUsage(u);
    if (![p.tokens_in, p.tokens_out, p.cache_read, p.cache_write].every((x) => x != null && Number.isFinite(Number(x)))) return null;
    sum.in += Number(p.tokens_in); sum.write += Number(p.cache_write); sum.read += Number(p.cache_read); sum.out += Number(p.tokens_out);
    steps++;
  }
  return steps ? { input: sum.in, cacheCreate: sum.write, cacheRead: sum.read, output: sum.out } : null;
}
let fromTr = null, trWhy = '';
if (spendGiven && tokens == null) {
  fromTr = readTranscript(agentId, engine);
  if (!fromTr) trWhy = ' N, R и O неизвестны: стенограмма вызова не найдена, --tokens не передан.';
}

// Секции: только на «своих» передачах, чтобы текст не попал не в ту зону
const kitText = arg('kit'), resultText = arg('result');
for (const [k, v] of [['kit', kitText], ['result', resultText]]) {
  if (process.argv.includes('--' + k) && (v == null || v === '')) die(`--${k}: пустое значение — нужен текст или «-» (stdin)`);
}
if (kitText != null && to !== 'run') die('--kit пишется только при --to run (комплект передаёт Kit исполнителю)');
if (resultText != null && to !== 'intent') die('--result пишется только при --to intent (исполнитель возвращает итог на проверку)');
if (kitText === '-' && resultText === '-') die('stdin один: «-» можно только у одного из --kit / --result');
const zoneBody = (v, what) => {
  const body = v === '-' ? fs.readFileSync(0, 'utf8') : v;
  if (!String(body).trim()) die(`--${what}: пустой текст — зона не заполняется пустотой`);
  if (/^##\s/m.test(body)) die(`--${what}: в тексте строка, начинающаяся с «## » — она сломала бы зоны карточки`);
  return String(body).replace(/\r\n/g, '\n').replace(/\s+$/, '');
};
const kitBody = kitText != null ? zoneBody(kitText, 'kit') : null;
const resultBody = resultText != null ? zoneBody(resultText, 'result') : null;

// Расход основной сессии (`Intent`): строки даёт скрипт адаптера движка, ядро путей не знает — ищет в каталоге скриптов адаптеров
const sessionSpendArg = arg('session-spend');
if (process.argv.includes('--session-spend') && (sessionSpendArg == null || sessionSpendArg === '')) die('--session-spend: нужен номер карточки NNN');
if (sessionSpendArg != null) {
  if (to !== 'accept' && to !== 'close') die('--session-spend пишется только при --to accept|close (расход Intent дописывается при принятии)');
  if (!/^\d{1,4}$/.test(sessionSpendArg)) die(`--session-spend "${sessionSpendArg}" — нужен номер карточки NNN`);
  if (sessionSpendArg.padStart(3, '0') !== id.replace(/^card-0*(\d+)$/, (m, d) => d.padStart(3, '0'))) die(`--session-spend ${sessionSpendArg} — не номер карточки ${id}`);
}
function sessionSpendLines(num) {
  const E = require('../dashboard/lib/engines.cjs');
  let script = null;
  for (const a of E.loadAdapters(ROOT)) {
    const f = path.join(ROOT, E.sourcesOf(a).scriptsDir, 'card-session-spend.cjs');
    if (fs.existsSync(f) && (!script || a.spendTag === engine || a.engine === engine)) script = f;
  }
  if (!script) die('--session-spend: у адаптеров движка нет card-session-spend.cjs');
  const r = require('child_process').spawnSync(process.execPath, [script, num], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) die(`--session-spend: card-session-spend.cjs ${num} — ${(r.stderr || r.stdout || 'код ' + r.status).trim()}`);
  return r.stdout.split(/\r?\n/).filter((l) => l.startsWith('- '));
}

// 1. Карточка: только живая
const files = cardFiles(ROOT, (n) => n.startsWith(id + '-') && n.endsWith('.md'));
if (!files.length) die(`карточки ${id} нет на доске`);
const file = files.find((f) => path.dirname(f) === BOARD);
if (!file) die(`${id} лежит в done/ — закрытую карточку не передают`);
const cardId = path.basename(file, '.md');

let text = fs.readFileSync(file, 'utf8');
const fm = parseFrontmatter(text);

// 2. Кто держит `run` (§7): по метке route-N — короткий маршрут (route-4) исполняет Kit, route-0/1 — Intent
let assignee = t.assignee;
if (to === 'run') {
  const labels = labelsOf(text);
  if (labels.includes('route-4')) assignee = 'Kit';
  else if (labels.includes('route-0') || labels.includes('route-1')) assignee = 'Intent';
}
// 3. Чья строка: для `intent` — тот, кто исполнял, иначе узел по таблице
const node = arg('node') || (to === 'intent' && ['Run', 'Kit', 'Intent'].includes(fm.assignee) ? fm.assignee : t.by);
if (!/^[A-Za-z]\w*$/.test(node)) die(`--node "${node}" — не имя узла`);

// 4. Правка frontmatter: status, assignee, modified (+ completedAt на close)
const now = new Date().toISOString();
const day = now.slice(0, 10);
const setField = (src, key, val) => {
  const re = new RegExp('^' + key + ':.*$', 'm');
  if (!re.test(src)) die(`в frontmatter нет поля ${key}`);
  return src.replace(re, `${key}: ${val}`);
};
text = setField(text, 'status', `"${t.status}"`);
text = setField(text, 'assignee', `"${assignee}"`);
text = setField(text, 'modified', `"${now}"`);
if (to === 'close') text = setField(text, 'completedAt', `"${now}"`);

// 4б. Тело зоны «Комплект» / «Результат» — заголовок ищется по якорю или по словарю, на любом языке карточки
const setZone = (src, key, body) => {
  const head = i18n.headingRe('zone.' + key, '');
  const lines = src.split('\n');
  const i = lines.findIndex((l) => head.test(l.replace(/\r$/, '')));
  if (i < 0) die(`в карточке нет зоны «${key}»`);
  let end = lines.findIndex((l, k) => k > i && l.startsWith('## '));
  if (end < 0) end = lines.length;
  return lines.slice(0, i + 1).concat(['', ...body.split('\n'), ''], lines.slice(end)).join('\n');
};
if (kitBody != null) text = setZone(text, 'kit', kitBody);
if (resultBody != null) text = setZone(text, 'result', resultBody);

// 5. Строка этапа — в конец зоны «История» (перед зоной результата)
const projectMd = fs.readFileSync(projectFile(ROOT, 'PROJECT.md'), 'utf8');
const zoneHist = zoneHeadingIn(text, 'history');
const zoneRes = zoneHeadingIn(text, 'result');
if (!zoneHist) die('в карточке нет зоны «История»');
const line = `- \`${node}\`, ${day}: stage ${t.stage} — ${note.replace(/\.?\s*$/, '.')}`;
const histAt = text.indexOf('\n## ' + zoneHist);
const resAt = zoneRes ? text.indexOf('\n## ' + zoneRes, histAt + 1) : -1;
const histEnd = resAt === -1 ? text.length : resAt;
const body = text.slice(histAt, histEnd).replace(/\s*$/, '');
const n = note.replace(/\.?\s*$/, '.');
const spend = !spendGiven ? '' : formatSpendLine({
  node, date: day,
  tokens: fromTr ? fromTr.input + fromTr.cacheCreate + fromTr.cacheRead + fromTr.output : (tokens != null ? Number(tokens) : null),
  cache_read: cacheRead != null ? Number(cacheRead) : (fromTr ? fromTr.cacheRead : null),
  tokens_out: fromTr ? fromTr.output : undefined,
  duration_s: Math.round(Number(durationMs) / 1000), turns: turns != null ? Number(turns) : undefined,
  call_id: agentId, engine, desc: n + (cacheRead != null || fromTr || trWhy ? '' : ' cache-read движок не вернул.') + trWhy,
}).replace(/^/, '- ') + '\n';
const sessionLines = sessionSpendArg == null ? '' : sessionSpendLines(sessionSpendArg.padStart(3, '0'))
  .filter((l) => !text.includes(l.split(' — ')[0])).map((l) => l + '\n').join('');
text = text.slice(0, histAt) + body + '\n' + spend + sessionLines + line + '\n' + (resAt === -1 ? '' : text.slice(resAt));

// 6. Запись; на close файл уходит в done/ (расширение доски делает это само, без него — мы)
const target = to === 'close' ? path.join(BOARD, 'done', cardId + '.md') : file;
if (flag('dry')) { console.log(path.relative(ROOT, target).replace(/\\/g, '/') + '\n' + text); process.exit(0); }
if (target !== file) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.renameSync(file, target); }
fs.writeFileSync(target, text);
console.log(path.relative(ROOT, target).replace(/\\/g, '/'));

// 6б. Инвалидация / пересчет кэша дашборда при обновлении карточки
try {
  const cacheFile = path.join(ROOT, '.forma', 'dashboard', '.cache', 'data.json');
  if (fs.existsSync(cacheFile)) {
    let rebuilt = false;
    const candidates = [
      path.join(ROOT, '.forma', 'dashboard', 'generate.js'),
      path.resolve(__dirname, '../dashboard/generate.js'),
    ];
    for (const genFile of candidates) {
      if (fs.existsSync(genFile)) {
        try {
          const { buildData } = require(genFile);
          const data = buildData(ROOT);
          fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf8');
          rebuilt = true;
          break;
        } catch {}
      }
    }
    if (!rebuilt) {
      fs.rmSync(cacheFile, { force: true });
    }
  }
} catch {}

// 7. Проверка по этой карточке
const mine = checkBoard(ROOT).filter((p) => p.includes(cardId));
if (mine.length) { console.error(mine.join('\n')); process.exit(1); }
console.log(`ok: ${cardId} → ${t.status}/${assignee} · stage ${t.stage}`);

if (to === 'close') {
  const epic = fm.epic;
  if (epic) {
    const cycleVol = i18n.rowNumber(projectMd, 'volume') ?? 25;
    const doneDir = path.join(BOARD, 'done');
    let count = 0;
    if (fs.existsSync(doneDir)) {
      for (const f of fs.readdirSync(doneDir)) {
        if (!f.endsWith('.md')) continue;
        try {
          const cText = fs.readFileSync(path.join(doneDir, f), 'utf8');
          const cBlock = frontmatterBlock(cText) || '';
          const cEpic = (cBlock.match(/^epic:\s*"(.+?)"/m) || [])[1];
          const cAssignee = (cBlock.match(/^assignee:\s*"?(.+?)"?\s*$/m) || [])[1];
          const cStatus = (cBlock.match(/^status:\s*"(.+?)"/m) || [])[1];
          if (cEpic === epic && cStatus === 'done' && cAssignee === 'Core') count++;
        } catch {}
      }
    }
    const note = count >= cycleVol ? 'Пора Core.' : 'Накопление в done/Core продолжается.';
    console.log(`Круг по эпику "${epic}": ${count}/${cycleVol} карточек. ${note}`);
  }
}
