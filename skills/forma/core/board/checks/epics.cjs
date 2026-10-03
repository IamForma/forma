'use strict';

// Сверка доски с дорожной картой: содержательный эпик = цель, один к одному.
// Метка цели — истина; эпик — дорожка её вида. Метка обязательна вперёд, с дня вступления правила `goal-label`.

const fs = require('fs');
const path = require('path');
const { cardFiles, boardDir, labelsOf, createdDay } = require('../../dashboard/lib/card.cjs');

// Девять видов цели: код не зависит от языка, лейбл эпика — во втором столбце таблицы PROJECT.md. Коды меняет только человек.
const CODES = ['value', 'docs', 'forma', 'result-image', 'core', 'incoming', 'goal', 'experience', 'review-image'];
const GOAL_LABEL_RE = new RegExp('^goal-(\\d+|' + CODES.join('|') + ')$');

const read = (file) => fs.readFileSync(file, 'utf8');

/** Код вида → лейбл эпика, из таблицы эпиков `project/PROJECT.md` (первая строка кода побеждает). */
function readLanes(root) {
  const laneOf = new Map();
  const projectMd = path.join(root, 'project', 'PROJECT.md');
  if (!fs.existsSync(projectMd)) return laneOf;
  const re = new RegExp('^\\|\\s*`(' + CODES.join('|') + ')`\\s*\\|\\s*([^|]+?)\\s*\\|');
  for (const line of read(projectMd).split('\n')) {
    const m = line.match(re);
    if (m && !laneOf.has(m[1])) laneOf.set(m[1], m[2].replace(/`/g, ''));
  }
  return laneOf;
}

/** Цели — из имён каталогов `project/goals/`: главная goal-<код>, подцель goal-NN-*; черновик — GOAL.md с `draft: true` либо без GOAL.md. */
function readGoals(root) {
  const goals = new Set();
  const draft = new Set();
  const goalsDir = path.join(root, 'project', 'goals');
  if (!fs.existsSync(goalsDir)) return { goals, draft };
  for (const d of fs.readdirSync(goalsDir)) {
    if (!fs.statSync(path.join(goalsDir, d)).isDirectory()) continue;
    const m = d.match(/^goal-(\d+)/) || d.match(new RegExp('^goal-(' + CODES.join('|') + ')$'));
    if (!m) continue;
    goals.add('goal-' + m[1]);
    const goalMd = path.join(goalsDir, d, 'GOAL.md');
    if (!fs.existsSync(goalMd) || /^draft:\s*true\s*$/m.test(read(goalMd))) draft.add('goal-' + m[1]);
  }
  return { goals, draft };
}

/** Вид подцели — из карты `project/ROADMAP.md`: подцель стоит под своей главной целью (строка goal-<код>), глубже неё. */
function readKinds(root) {
  const kindOf = new Map();
  for (const c of CODES) kindOf.set('goal-' + c, c);
  const roadmap = path.join(root, 'project', 'ROADMAP.md');
  if (!fs.existsSync(roadmap)) return kindOf;
  let current = null;
  let depth = -1;
  const mainRe = new RegExp('^(.*?)goal-(' + CODES.join('|') + ')\\b');
  for (const line of read(roadmap).split('\n')) {
    if (!line.includes('── ')) continue;               // только строки дерева карты, не проза под ней
    const mm = line.match(mainRe);
    if (mm && !/goal-\d/.test(line.slice(0, mm[1].length + 8))) { current = mm[2]; depth = mm[1].length; continue; }
    const sm = line.match(/^(.*?)(goal-\d+)\b/);
    if (sm && current && sm[1].length > depth) kindOf.set(sm[2], current);
  }
  return kindOf;
}

/** Нарушения одной карточки: не больше одного до сверки цели, после неё — черновик цели и дорожка вида. */
function cardProblems(name, text, model) {
  const em = text.match(/^epic:\s*"(.+?)"/m);
  if (!em) return [`${name}: карточка без эпика`];
  const epic = em[1];
  if (!model.lanes.has(epic)) return [`${name}: эпик "${epic}" не из девяти видов (PROJECT.md, «Эпики проекта»)`];
  const gl = labelsOf(text).filter((l) => GOAL_LABEL_RE.test(l));
  if (gl.length !== 1) {
    return createdDay(text) >= model.since ? [`${name}: меток цели ${gl.length}, нужна ровно одна (goal-NN или goal-<код>)`] : [];
  }
  const g = gl[0];
  if (model.goals.size && !model.goals.has(g)) return [`${name}: метка ${g} — каталога цели нет в project/goals/`];
  const problems = [];
  const kind = model.kindOf.get(g);
  // Производство под черновиком цели — стоп старта. Интервью и прочие виды можно: они и формируют образ. Закрытые не трогаем.
  if (kind === 'goal' && model.draft.has(g) && !/^status:\s*"done"/m.test(text)) {
    problems.push(`${name}: производство под целью ${g} в черновике — сначала образ цели (GOAL.md draft: false)`);
  }
  if (kind && epic !== model.laneOf.get(kind) && epic !== model.laneOf.get('incoming')) {
    problems.push(`${name}: эпик "${epic}" не дорожка вида цели ${g} ("${model.laneOf.get(kind)}") — верна метка`);
  }
  return problems;
}

function run({ root, since }) {
  if (!fs.existsSync(boardDir(root))) return [];            // доски ещё нет — проверять нечего
  const laneOf = readLanes(root);
  if (!laneOf.size) {
    return ['PROJECT.md: не разобрана таблица эпиков (строки вида | `incoming` | <лейбл> | …) — ' +
            'проверка эпиков доски не выполнялась'];
  }
  const model = { laneOf, lanes: new Set(laneOf.values()), kindOf: readKinds(root), since, ...readGoals(root) };
  return cardFiles(root).flatMap((f) => cardProblems(path.basename(f), read(f), model));
}

module.exports = { id: 'epics', since: 'goal-label', run };
