#!/usr/bin/env node
// Передача карточки следующему узлу одним вызовом: status + assignee + строка этапа + проверка доски (AGENTS.md §6–7).
//
//   node .forma/board/card-move.cjs <card> --to kit|run|intent|accept|close --note "<что сделано>" [--node <узел>] [--dry]
//                                 [--tokens N --duration-ms MS --agent-id <id> [--cache-read R] [--turns K] [--engine claude-code]]
//                                 [--kit "<текст>"|-] [--result "<текст>"|-]
//
// <card>  — «NNN» или «card-NNN»; карточка живая (в done/ — уже закрыта, передавать нечего).
// --to    — куда передаём; таблица §7 → поля frontmatter, ключ этапа §6:
//             kit     todo        Kit      stage kit      пишет Intent: открыл цикл, карточка в комплектацию
//             run     in-progress Run      stage exec     пишет Kit: комплект готов, исполнение
//             intent  review      Intent   stage check     пишет тот, кто исполнял: результат на проверку
//             accept  review      Intent   stage accept    пишет Intent: проверка пройдена, ждёт «да» человека
//             close   done        Core     stage close    пишет Intent: человек принял; файл уходит в done/
//           Короткий маршрут (эпик с «/Intent+Kit»): исполняет Kit — `run` держит "Kit". Эпики «…/Intent»
//           без «+Kit» (документация, входящие): `run` держит "Intent" (§7, исключения).
// --note  — «что» в строке этапа; без него — ошибка: пустая строка этапа ничего не говорит.
// --node  — чья строка; по умолчанию узел, который делает эту передачу (см. таблицу; для `intent` — прежний исполнитель).
// Расход (AGENTS.md §3, ECONOMY.md) — вызывающий пишет его сразу после возврата узла; тот же вызов дописывает и строку расхода:
//           --tokens N (итог вызова), --duration-ms MS (секунды округляются), --agent-id <id вызова>; нужны все три сразу.
//           --cache-read R — иначе «(cache-read unknown)» с причиной в описании; --turns K — «K turns»; --engine — тег движка (claude-code).
//           Строка расхода идёт от узла `--node` (того, чей вызов вернулся), перед строкой этапа. Без этих флагов расход не пишется.
// Секции карточки — тем же вызовом, без отдельной правки файла:
//           --kit    — тело зоны «Комплект» (шесть единиц, AGENTS.md §6); только с --to run: Kit записывает комплект при передаче.
//           --result — тело зоны «Результат»; только с --to intent: исполнитель записывает итог при возврате на проверку.
//           Значение «-» читает текст из stdin (многострочный текст — через heredoc); иначе берётся сам аргумент. Тело зоны заменяется
//           целиком (при правке комплекта после возврата — новый комплект, а не дописывание). Только одно из двух может быть «-».
// --dry   — показать изменения, файл не писать.
// Пишет `modified` (на `close` — и `completedAt`), дописывает строку в «История», затем проверяет доску по этой карточке.
// Часть ядра: одна для всех движков, путей движка не знает.

const fs = require('fs');
const path = require('path');
const { makeCli } = require('../dashboard/lib/cli.cjs');
const { cardFiles, parseFrontmatter, zoneHeading } = require('../dashboard/lib/card.cjs');
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
if (!id || !to) die(`нужны <card> и --to ${Object.keys(TARGETS).join('|')}`);
if (!TARGETS[to]) die(`--to "${to}" — нет такого перехода (${Object.keys(TARGETS).join('|')})`);
if (!note || /[\n]/.test(note)) die('нужен --note "<что сделано>" в одну строку');
const t = TARGETS[to];

// Расход: все три обязательных поля сразу или ни одного
const tokens = arg('tokens'), durationMs = arg('duration-ms'), agentId = arg('agent-id');
const cacheRead = arg('cache-read'), turns = arg('turns'), engine = arg('engine') || 'claude-code';
const spendGiven = [tokens, durationMs, agentId].some((v) => v != null);
if (spendGiven) {
  if (tokens == null || durationMs == null || agentId == null) die('расход: нужны --tokens, --duration-ms и --agent-id вместе');
  const num = { tokens, 'duration-ms': durationMs, ...(cacheRead != null && { 'cache-read': cacheRead }), ...(turns != null && { turns }) };
  for (const [k, v] of Object.entries(num)) if (!/^\d+$/.test(v)) die(`--${k} "${v}" — нужно целое число`);
  if (!/^[\w.:-]+$/.test(agentId)) die(`--agent-id "${agentId}" — не похоже на id вызова`);
  if (!/^[a-z][\w-]*$/.test(engine)) die(`--engine "${engine}" — не тег движка`);
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

// 1. Карточка: только живая
const files = cardFiles(ROOT, (n) => n.startsWith(id + '-') && n.endsWith('.md'));
if (!files.length) die(`карточки ${id} нет на доске`);
const file = files.find((f) => path.dirname(f) === BOARD);
if (!file) die(`${id} лежит в done/ — закрытую карточку не передают`);
const cardId = path.basename(file, '.md');

let text = fs.readFileSync(file, 'utf8');
const fm = parseFrontmatter(text);

// 2. Кто держит `run` (§7): короткий маршрут и эпики «…/Intent» исполняет не Run
let assignee = t.assignee;
if (to === 'run') {
  const epic = fm.epic || '';
  if (/\/Intent\+Kit\b/.test(epic)) assignee = 'Kit';
  else if (/\/Intent\s*$/.test(epic)) assignee = 'Intent';
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
const word = (i18n.reader(projectMd).inline('language') || '').split(/\s+/)[0];
const code = i18n.langCode(word);
const anchored = !!word && !(code in i18n.KEYS.languages);
const headings = ['ru', 'en'].map((l) => ({ hist: zoneHeading('history', l, anchored), res: zoneHeading('result', l, anchored) }));
const zone = headings.find((h) => text.includes('\n## ' + h.hist));
if (!zone) die('в карточке нет зоны «История»');
const line = `- \`${node}\`, ${day}: stage ${t.stage} — ${note.replace(/\.?\s*$/, '.')}`;
const histAt = text.indexOf('\n## ' + zone.hist);
const resAt = text.indexOf('\n## ' + zone.res, histAt + 1);
const histEnd = resAt === -1 ? text.length : resAt;
const body = text.slice(histAt, histEnd).replace(/\s*$/, '');
const n = note.replace(/\.?\s*$/, '.');
const spend = !spendGiven ? '' : formatSpendLine({
  node, date: day, tokens: Number(tokens), cache_read: cacheRead != null ? Number(cacheRead) : null,
  duration_s: Math.round(Number(durationMs) / 1000), turns: turns != null ? Number(turns) : undefined,
  call_id: agentId, engine, desc: n + (cacheRead != null ? '' : ' cache-read движок не вернул.'),
}).replace(/^/, '- ') + '\n';
text = text.slice(0, histAt) + body + '\n' + spend + line + '\n' + (resAt === -1 ? '' : text.slice(resAt));

// 6. Запись; на close файл уходит в done/ (расширение доски делает это само, без него — мы)
const target = to === 'close' ? path.join(BOARD, 'done', cardId + '.md') : file;
if (flag('dry')) { console.log(path.relative(ROOT, target).replace(/\\/g, '/') + '\n' + text); process.exit(0); }
if (target !== file) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.renameSync(file, target); }
fs.writeFileSync(target, text);
console.log(path.relative(ROOT, target).replace(/\\/g, '/'));

// 7. Проверка по этой карточке; счёт «принятых, но не закрытых Core» — сводка цикла, а не нарушение карточки
const mine = checkBoard(ROOT).filter((p) => p.includes(cardId) && !p.includes('не закрыты `Core`'));
if (mine.length) { console.error(mine.join('\n')); process.exit(1); }
console.log(`ok: ${cardId} → ${t.status}/${assignee} · stage ${t.stage}`);
