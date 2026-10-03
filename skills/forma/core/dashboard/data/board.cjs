'use strict';

/**
 * Вкладки «Доска», «Цели», «Скиллы» и «Закон»: карточки целиком (`board-card.cjs`), связи между ними —
 * материалы, упоминания, ADR, коммиты, — пороги и образы целей, скиллы проекта.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { readIfExists } = require('../lib/fs.cjs');
const { boardDir } = require('../lib/card.cjs');
const engines = require('../lib/engines.cjs');
const { parseBoardCard } = require('./board-card.cjs');
const { buildLaw } = require('./law.cjs');

/** Скиллы проекта: имя → описание из frontmatter `SKILL.md`. */
function readSkills(projectRoot) {
  const skills = {};
  const dir = engines.firstPath(projectRoot, 'skillsDir');
  if (!dir || !fs.existsSync(dir)) return skills;
  for (const d of fs.readdirSync(dir)) {
    const f = path.join(dir, d, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    skills[d] = ((text.match(/^description:\s*(.+)$/m) || [, ''])[1]).replace(/^["']|["']$/g, '');
  }
  return skills;
}

function readCards(dir, skillNames) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^card-\d+.*\.md$/.test(f))
    .map((f) => parseBoardCard(f, fs.readFileSync(path.join(dir, f), 'utf8'), skillNames));
}

/** Цели: код → заголовок из `GOAL.md`. */
function readGoals(projectRoot) {
  const dir = path.join(projectRoot, 'project', 'goals');
  if (!fs.existsSync(dir)) return {};
  const out = {};
  for (const d of fs.readdirSync(dir)) {
    const f = path.join(dir, d, 'GOAL.md');
    if (!fs.existsSync(f)) continue;
    out[d] = (fs.readFileSync(f, 'utf8').match(/^# (.+)$/m) || [, d])[1];
  }
  return out;
}

/** Образ, черновик и «кто закрывает» каждой цели. */
function readGoalInfo(projectRoot) {
  const dir = path.join(projectRoot, 'project', 'goals');
  const info = {};
  if (!fs.existsSync(dir)) return info;
  for (const d of fs.readdirSync(dir)) {
    const f = path.join(dir, d, 'GOAL.md');
    if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, 'utf8');
    const img = (t.match(/\*\*Образ в этом проекте\*\*:\s*(.+)/) || t.match(/\*\*Образ по умолчанию\*\*:\s*(.+)/) || [, ''])[1];
    info[d] = {
      image: img.trim().slice(0, 600),
      draft: /^draft:\s*true/m.test(t),
      closer: ((t.match(/\*\*Кто закрывает\*\*:\s*(.+)/) || [, ''])[1]).trim(),
    };
  }
  return info;
}

/** Пороги «заходов на задачу» и «объёма круга» из `PROJECT.md`; нет числа — `null`. */
function readThresholds(projectRoot) {
  const pj = readIfExists(path.join(projectRoot, 'project', 'PROJECT.md'));
  return {
    attempts: +((pj.match(/Заходов на задачу\s*\|\s*(\d+)/) || [])[1]) || null,
    volume: +((pj.match(/Объём круга[^|]*\|\s*(\d+)/) || [])[1]) || null,
  };
}

function readAdrs(projectRoot) {
  const dir = path.join(projectRoot, 'project', 'adr');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^\d{4}-.*\.md$/.test(f)).map((f) => ({ f, t: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

/** История git: `[хеш, дата, тема]`; нет git или истории — пусто, карточки остаются без дат коммитов. */
function readCommits(projectRoot) {
  try {
    return execSync('git log --pretty=format:%h%x09%ad%x09%s --date=short', { cwd: projectRoot, encoding: 'utf8', maxBuffer: 1 << 26 })
      .split('\n').map((l) => l.split('\t'));
  } catch {
    return [];
  }
}

/** После-зависимости: `after-card-NNN` открыта, пока та карточка не в `done`. */
function markOpenDeps(cards) {
  const doneCodes = new Set(cards.filter((c) => c.status === 'done').map((c) => c.code));
  cards.forEach((c) => { c.ready.depsOpen = c.ready.deps.filter((d) => !doneCodes.has(d)); });
}

/** Связи карточки: материалы, упоминания в других карточках, ADR, коммиты, флаг «ждёт решения человека». */
function linkCards(cards, { projectRoot, adrs, commits }) {
  const cardsDir = path.join(projectRoot, 'project', 'cards');
  cards.forEach((c) => {
    const n = c.code.replace('card-', '');
    const re = new RegExp(`(card-${n}(?!\\d)|[Кк]арточк\\p{L}*\\s+${n}(?!\\d))`, 'u');
    const md = path.join(cardsDir, c.code);
    c.materials = fs.existsSync(md) ? fs.readdirSync(md, { recursive: true }).map(String).filter((f) => fs.statSync(path.join(md, f)).isFile()) : [];
    c.mentions = cards.filter((o) => o !== c && re.test(o.text)).map((o) => o.code);
    c.adrs = adrs.filter((a) => re.test(a.t)).map((a) => a.f);
    c.commits = commits.filter(([, , s]) => re.test(s || '')).slice(0, 15);
    c.humanFlag = /ожида\p{L}* решени|ждёт решени|awaiting (a )?decision/iu.test(c.text) && c.status !== 'done';
  });
}

function buildBoard(projectRoot) {
  const skills = readSkills(projectRoot);
  const names = Object.keys(skills);
  const dir = boardDir(projectRoot);
  const cards = [...readCards(dir, names), ...readCards(path.join(dir, 'done'), names)]
    .sort((a, b) => String(b.modified).localeCompare(String(a.modified)));
  markOpenDeps(cards);
  linkCards(cards, { projectRoot, adrs: readAdrs(projectRoot), commits: readCommits(projectRoot) });
  cards.forEach((c) => { delete c.text; }); // text нужен только для поиска связей
  return {
    law: buildLaw(projectRoot),
    thresholds: readThresholds(projectRoot),
    goalInfo: readGoalInfo(projectRoot),
    project: path.basename(projectRoot),
    skills,
    generated: new Date().toISOString(),
    goals: readGoals(projectRoot),
    cards,
  };
}

module.exports = { buildBoard };
