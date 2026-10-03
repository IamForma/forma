'use strict';

/**
 * Цепь производства: интервью → образ → цель → эпик → карточки. Ничего не чинит и ничего не советует:
 * показывает, где звено появилось раньше своего предшественника. Порядок нарушен — это факт для человека.
 */

const fs = require('fs');
const path = require('path');
const { walk, readIfExists } = require('../lib/fs.cjs');
const { boardDir, parseFrontmatter } = require('../lib/card.cjs');

const SETUP_STEPS = [
  { n: '1',   name: 'Бриф (интервью)',      file: 'project/brief/interview.md' },
  { n: '1b',  name: 'Взгляд узлов',         file: 'project/brief/nodes-vision.md' },
  { n: '2',   name: 'История',              file: 'project/brief/history.md' },
  { n: '3',   name: 'Карта сайта',          file: 'project/mockups/sitemap.md' },
  { n: '4',   name: 'Prompt лендинга',      file: 'project/brief/prompt.md' },
  { n: '5',   name: 'Референсы',            file: 'project/brief/reference.md' },
  { n: '6',   name: 'Дизайн-система',       file: 'project/reference/design-system.md' },
  { n: '9',   name: 'Макап загружен',       dir:  'project/mockups', glob: /^v\d+$/ },
  { n: '10b', name: 'Комплектация',         file: 'project/brief/kitting.md' },
];

const readOrNull = (p) => readIfExists(p, null);

/**
 * Состояние шага подготовки. Наличие файла шагом не является: часть из них лежит в проекте готовым шаблоном
 * с первого дня — с методикой внутри и пустыми местами под ответы. Заполненным считается тот, где есть запись
 * с датой (правило «разошлось — новая запись с датой»). Ни одной даты, а заготовки на месте — это шаблон,
 * не сделанный шаг, и он называется своим именем.
 */
function setupState(root, step) {
  if (step.file) {
    const body = readOrNull(path.join(root, step.file));
    if (body === null) return 'missing';
    const dated = /\b20\d\d-\d\d-\d\d\b/.test(body);
    const placeholder = /<!--/.test(body);
    return dated ? 'done' : (placeholder || body.trim().length < 400) ? 'template' : 'done';
  }
  const dir = path.join(root, step.dir);
  if (!fs.existsSync(dir)) return 'missing';
  return fs.readdirSync(dir).some((d) => step.glob.test(d)) ? 'done' : 'missing';
}

/** Подготовка проекта — общие ворота, один раз на проект. */
function readSetup(root) {
  return SETUP_STEPS.map((s) => {
    const state = setupState(root, s);
    return { n: s.n, name: s.name, target: s.file || s.dir, state, done: state === 'done' };
  });
}

/** Имена процессных эпиков — из PROJECT.md, тем же правилом, что у sync-engines. */
function readProcessEpics(root) {
  const names = new Set();
  const projectMd = readOrNull(path.join(root, 'project', 'PROJECT.md'));
  if (!projectMd) return names;
  for (const line of projectMd.split('\n')) {
    const m = line.match(/^\|\s*`(incoming|value|infra|config)`\s*\|\s*([^|]+?)\s*\|/);
    if (m) names.add(m[2]);
  }
  return names;
}

/** Цели: каталог даёт существование, GOAL.md — заполнен ли образ. */
function readGoalDirs(root) {
  const goalsDir = path.join(root, 'project', 'goals');
  const goals = new Map();
  if (!fs.existsSync(goalsDir)) return goals;
  for (const d of fs.readdirSync(goalsDir)) {
    // goal-NN — подцель, goal-<код> — главная цель вида.
    const m = d.match(/^(goal-\d+)/) || d.match(/^(goal-[a-z][a-z-]*)$/);
    if (!m || !fs.statSync(path.join(goalsDir, d)).isDirectory()) continue;
    const goalMd = readOrNull(path.join(goalsDir, d, 'GOAL.md'));
    goals.set(m[1], {
      id: m[1], dir: d, roadmapName: null,
      hasGoalMd: goalMd !== null, draft: goalMd ? /^draft:\s*true\s*$/m.test(goalMd) : true,
      bytes: goalMd ? Buffer.byteLength(goalMd, 'utf8') : 0,
      epic: null, cards: 0, cardsDone: 0,
    });
  }
  return goals;
}

/** ROADMAP.md даёт цели имя. */
function nameGoalsFromRoadmap(root, goals) {
  const roadmap = readOrNull(path.join(root, 'project', 'ROADMAP.md'));
  if (!roadmap) return;
  for (const line of roadmap.split('\n')) {
    const m = line.match(/(goal-(?:\d+|[a-z][a-z-]*))\s*[·:—]\s*(.+?)\s*$/);
    if (m && goals.has(m[1]) && !goals.get(m[1]).roadmapName) {
      goals.get(m[1]).roadmapName = m[2];
    }
  }
}

/**
 * Эпики доски, привязанные к целям: пишет число карточек в цели, возвращает эпики без цели (имя → число карточек).
 * Истина — метка цели в labels; старое имя эпика «goal-NN …/SKRIC» — запасной путь для давних карточек.
 */
function attachEpics(root, goals, processEpics) {
  const orphanEpics = new Map();
  const dir = boardDir(root);
  const files = fs.existsSync(dir) ? walk(dir, { ext: '.md', abs: true }) : [];
  for (const file of files) {
    const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!fm.id || !fm.epic) continue;
    if (processEpics.has(fm.epic)) continue;
    const lab = (Array.isArray(fm.labels) ? fm.labels : []).find((l) => goals.has(l));
    const g = lab ? [lab, lab] : String(fm.epic).match(/^(goal-\d+)\s+(.+?)\/SKRIC$/);
    if (g && goals.has(g[1])) {
      const goal = goals.get(g[1]);
      goal.epic = fm.epic;
      goal.cards += 1;
      if (file.includes(`${path.sep}done${path.sep}`)) goal.cardsDone += 1;
    } else {
      const key = String(fm.epic);
      orphanEpics.set(key, (orphanEpics.get(key) || 0) + 1);
    }
  }
  return orphanEpics;
}

function goalViolations(goal) {
  const out = [];
  const production = /^goal-(\d+|goal)$/.test(goal.id); // интервью под черновиком — норма: оно и формирует образ
  if (production && goal.cards > 0 && goal.draft) {
    out.push({
      kind: 'cards-without-image', goal: goal.id, count: goal.cards,
      text: `${goal.id}: ${goal.cards} карточек нарезано под цель, у которой образ результата — черновик`,
    });
  }
  if (/^goal-\d+$/.test(goal.id) && goal.epic && goal.roadmapName && !goal.roadmapName.startsWith(
    goal.epic.replace(/^goal-\d+\s+/, '').replace(/\/SKRIC$/, ''))) {
    out.push({
      kind: 'epic-name-drift', goal: goal.id,
      text: `${goal.id}: имя эпика разошлось с ROADMAP.md — там «${goal.roadmapName}»`,
    });
  }
  if (!goal.hasGoalMd) {
    out.push({ kind: 'no-goal-md', goal: goal.id, text: `${goal.id}: нет GOAL.md` });
  }
  return out;
}

/** Нарушения порядка: карточки без образа, эпик разошёлся с ROADMAP, нет GOAL.md, эпик без цели, образ без интервью. */
function chainViolations(goals, orphanEpics, interviewDone) {
  const violations = [];
  for (const goal of goals.values()) violations.push(...goalViolations(goal));
  for (const [epic, count] of orphanEpics) {
    violations.push({
      kind: 'epic-without-goal', goal: null, count,
      text: `эпик «${epic}» (${count} карточек) не привязан ни к одной цели`,
    });
  }
  const withImage = [...goals.values()].filter((g) => !g.draft).length;
  if (!interviewDone && withImage) {
    violations.push({
      kind: 'image-without-interview', goal: null,
      text: `${withImage} целей с заполненным образом, но брифа интервью нет (шаг 1)`,
    });
  }
  return violations;
}

function chainSummary(goals) {
  const all = [...goals.values()];
  return {
    goalsTotal: goals.size,
    goalsWithImage: all.filter((g) => !g.draft).length,
    goalsWithEpic: all.filter((g) => g.epic).length,
    cardsUnderDraft: all.filter((g) => g.draft).reduce((s, g) => s + g.cards, 0),
  };
}

function buildChain(projectRoot) {
  const setup = readSetup(projectRoot);
  const interviewDone = setup[0].done;
  const goals = readGoalDirs(projectRoot);
  nameGoalsFromRoadmap(projectRoot, goals);
  const orphanEpics = attachEpics(projectRoot, goals, readProcessEpics(projectRoot));
  return {
    setup,
    interviewDone,
    goals: [...goals.values()].sort((a, b) => a.id.localeCompare(b.id)),
    violations: chainViolations(goals, orphanEpics, interviewDone),
    summary: chainSummary(goals),
  };
}

module.exports = { buildChain };
