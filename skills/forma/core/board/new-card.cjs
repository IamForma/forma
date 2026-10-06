#!/usr/bin/env node
// Создание карточки на доске .devtool/features/ — без ручного копирования имени эпика, номера и шаблона.
//
//   node .forma/board/new-card.cjs --kind <код> --title "<заголовок>" [--goal goal-NN] [--type дело|оснастка|решение]
//                                     [--status backlog] [--assignee Intent] [--priority medium] [--lang ru|en] [--dry]
//                                     [--route N] [--over N]… [--seg N] [--wave N] [--after NNN]… [--trial]
//                                     [--delivers "<что даёт>"] [--criterion "<критерий>"] [--budget "<попытки>"] [--next "<куда дальше>"]
//                                     [--why <код>] [--why-detail "<пояснение>"] [--stage card|approve]
//
// --kind   — код вида из PROJECT.md, «Эпики проекта» (value, docs, forma, result-image, core, incoming, goal, experience, review-image).
//            Имя эпика подставляется точно из таблицы — поле `epic` (AGENTS.md §7).
// --goal   — метка цели; по умолчанию главная цель вида `goal-<код>` (AGENTS.md §6, ровно одна метка).
// --route/--over/--seg/--wave/--after/--trial — метки маршрута (AGENTS.md §6; ROUTES.md §9). --over и --after повторяемы.
// --delivers/--criterion/--budget/--next — поля задачи (§6) сразу, без правки файла после записи; не заданное остаётся заготовкой <…>.
// --why — причина маршрута (§6, коды: human|ready|scale|risk|decision|tooling): пишет в «История» строку `route route-N (why: …)`;
//            --stage — строку `stage <ключ>` (card — задача пишется, approve — ждёт «да» человека). Без флага строка не пишется.
// Номер — следующий свободный `card-NNN` по доске и done/. Зоны — на языке проекта (§6).
// После записи — проверка доски ядра (.forma/board/check-board.cjs) по этой карточке; ошибка по ней — код выхода 1.
// Часть ядра: одна для всех движков, путей движка не знает.

const fs = require('fs');
const { projectFile } = require('../dashboard/lib/fs.cjs');
const path = require('path');
const { execFileSync } = require('child_process');
const { makeCli } = require('../dashboard/lib/cli.cjs');
const { cardFiles, zoneHeading } = require('../dashboard/lib/card.cjs');
const i18n = require('../i18n/index.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const BOARD = path.join(ROOT, '.devtool', 'features');

const cli = makeCli();
const { arg, flag, values: args } = cli;
const die = cli.die('new-card');

// 1. Эпики из PROJECT.md
const projectMd = fs.readFileSync(projectFile(ROOT, 'PROJECT.md'), 'utf8');
const lanes = new Map();
for (const m of projectMd.matchAll(/^\|\s*`([a-z-]+)`\s*\|\s*([^|]+?)\s*\|/gm)) lanes.set(m[1], m[2]);
if (!lanes.size) die('в PROJECT.md не найдена таблица «Эпики проекта»');

const kind = arg('kind');
const title = arg('title');
if (!kind || !title) die('нужны --kind <код> и --title "<заголовок>". Коды: ' + [...lanes.keys()].join(', '));
if (!lanes.has(kind)) die(`неизвестный код "${kind}". Коды: ` + [...lanes.keys()].join(', '));
const epic = lanes.get(kind);

// 2. Метка цели
const goal = arg('goal', 'goal-' + kind);
if (!/^goal-(\d+|[a-z-]+)$/.test(goal)) die(`метка цели "${goal}" не вида goal-NN / goal-<код>`);
const goalsDir = path.join(ROOT, 'project', 'goals');
if (fs.existsSync(goalsDir) && !fs.readdirSync(goalsDir).some(d => d === goal || d.startsWith(goal + '-')))
  die(`каталога цели ${goal} нет в project/goals/`);

// 2б. Метки маршрута
const routeLabels = [];
const route = arg('route');
if (route !== undefined) { if (!/^[0-8]$/.test(route)) die(`маршрут "${route}" — нет route-${route}; коды route-0…route-8`); routeLabels.push('route-' + route); }
for (const o of args('over')) { if (!/^[1-4]$/.test(o || '')) die(`наложение "${o}" — нет over-${o}; коды over-1…over-4`); routeLabels.push('over-' + o); }
for (const k of ['seg', 'wave']) { const v = arg(k); if (v === undefined) continue; if (!/^[1-9]\d*$/.test(v)) die(`--${k} "${v}" — нужно натуральное число`); routeLabels.push(k + '-' + v); }
for (const a of args('after')) { const n = (a || '').replace(/^card-/, ''); if (!/^\d+$/.test(n)) die(`--after "${a}" — нужен номер карточки NNN`); routeLabels.push('after-card-' + n.padStart(3, '0')); }
if (flag('trial')) routeLabels.push('trial');

// 3. Language: --lang, else the project language field; a language without a card set (work/tooling/decision) is English
let lang = arg('lang');
// language of the project documents: without a dictionary entry the zone headings carry anchors (a translation keeps the key)
const word = (i18n.reader(projectMd).inline('language') || '').split(/\s+/)[0];
const code = i18n.langCode(word);
const anchored = !!word && !(code in i18n.KEYS.languages);
if (!lang) lang = code === 'ru' ? 'ru' : 'en';
const Z = {
  task: zoneHeading('task', lang, anchored), kit: zoneHeading('kit', lang, anchored), hist: zoneHeading('history', lang, anchored), res: zoneHeading('result', lang, anchored),
  types: lang === 'ru' ? ['дело', 'оснастка', 'решение'] : ['work', 'tooling', 'decision'],
};
const type = arg('type', Z.types[kind === 'goal' ? 0 : 1]);
const fields = [['delivers', '<что даёт>'], ['criterion', '<критерий готовности>'], ['budget', '<бюджет попыток>'], ['next', '<куда дальше>']]
  .map(([k, ph]) => { const v = arg(k); if (v !== undefined && /[|\n]/.test(v)) die(`--${k}: символ | и перевод строки не допускаются — поля разделены «|»`); return v || ph; });

// 3б. Строки истории: причина маршрута и этап (§6)
const WHY_CODES = ['human', 'ready', 'scale', 'risk', 'decision', 'tooling'];
const STAGE_KEYS = ['card', 'approve'];
const why = arg('why'), stage = arg('stage');
if (why !== undefined && !WHY_CODES.includes(why)) die(`--why "${why}" — нет такого кода (${WHY_CODES.join('|')})`);
if (stage !== undefined && !STAGE_KEYS.includes(stage)) die(`--stage "${stage}" — при создании только ${STAGE_KEYS.join('|')}`);
const routeLabel = routeLabels.find(l => l.startsWith('route-'));
if (why !== undefined && !routeLabel) die('--why требует --route N: причина пишется для метки маршрута');

// 4. Статус и исполнитель по маршруту (AGENTS.md §7): backlog держит Spec на производстве, на остальных дорожках — Intent
const noSpec = kind !== 'goal'; // Spec режет только производство (7); прочие дорожки открывает Intent
const status = arg('status', 'backlog');
const assignee = arg('assignee', noSpec ? 'Intent' : 'Spec');
const priority = arg('priority', 'medium');

// 5. Номер
let max = 0;
for (const f of cardFiles(ROOT, /^card-\d+/)) max = Math.max(max, +path.basename(f).match(/^card-(\d+)/)[1]);
const num = String(max + 1).padStart(3, '0');
const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'j',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
const slug = title.toLowerCase().split('').map(c => TR[c] ?? c).join('')
  .replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 50).replace(/-$/, '');
const id = `card-${num}-${slug || 'task'}`;
const now = new Date().toISOString();
const day = now.slice(0, 10);
const detail = arg('why-detail');
const history = [
  why !== undefined ? `- \`Intent\`, ${day}: route ${routeLabel} (why: ${why})${detail ? ' — ' + detail.replace(/\.?$/, '.') : '.'}` : '',
  stage !== undefined ? `- \`Intent\`, ${day}: stage ${stage} — карточка создана.` : '',
].filter(Boolean).join('\n');

const text = `---
id: "${id}"
status: "${status}"
priority: "${priority}"
assignee: ${assignee === 'null' ? 'null' : `"${assignee}"`}
epic: "${epic}"
dueDate: null
created: "${now}"
modified: "${now}"
completedAt: null
labels: [${[goal, ...routeLabels].map(l => `"${l}"`).join(', ')}]
order: "a0"
---
# card-${num} · ${title}

## ${Z.task}
${num} · ${type} | ${fields.join(' | ')}

## ${Z.kit}

## ${Z.hist}
${history ? history + '\n' : ''}
## ${Z.res}
`;

const file = path.join(BOARD, id + '.md');
if (flag('dry')) { console.log(file + '\n' + text); process.exit(0); }
fs.mkdirSync(BOARD, { recursive: true });
fs.writeFileSync(file, text);
console.log(path.relative(ROOT, file).replace(/\\/g, '/'));

// 6. Проверка по этой карточке
let out = '';
try { out = execFileSync(process.execPath, [path.join(__dirname, 'check-board.cjs'), id], { cwd: ROOT, encoding: 'utf8' }); }
catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
const mine = out.split('\n').filter(l => l.includes(id));
if (mine.length) { console.error(mine.join('\n')); process.exit(1); }
console.log(`ok: ${epic} · ${goal} · ${status}/${assignee}`);
