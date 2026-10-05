'use strict';

/**
 * Вкладки «Проект» и «Движок»: только чтение. «Проект» — `project/config/PROJECT.md` и `GOAL.md` целей;
 * «Движок» — настройки движка, которые читает адаптер (`engineSettings`), он же держит запрет 15 (у секретов
 * только имя), плюс каталог маршрутов. Нет адаптера — настройки не найдены, а не пустые.
 */

const fs = require('fs');
const path = require('path');
const { readIfExists, projectFile } = require('../lib/fs.cjs');
const i18n = require('../../i18n/index.cjs');
const { parseFrontmatter } = require('../lib/card.cjs');
const engines = require('../lib/engines.cjs');
const { readRoutesCatalog } = require('./routes.cjs');

const { UNKNOWN } = engines;

/** Оснастка узлов: строка считается пустой, если пусты все колонки кроме имени узла. */
function toolingView(tooling) {
  return {
    columns: tooling ? tooling.columns : [],
    rows: tooling ? tooling.rows.filter((r) => r.slice(1).some((c) => c)) : [],
    total: tooling ? tooling.rows.length : 0,
  };
}

const ORIGIN = { core: 'ядро', project: 'проект', unknown: '—' };

/**
 * Умения проекта — из каталога скиллов движка: имя папки и `description` из `SKILL.md`. Отдельной описи нет.
 * Признак: `ядро` — имя среди умений, что поставляет шаблон (список отдаёт адаптер, `templateSkills`; он едет
 * с установленным адаптером, клон .forma/protocol/ не нужен), иначе `проект`. Адаптер списка не объявил — источника
 * нет, и признак «—», а не молчаливое «проект».
 */
function readSkills(projectRoot) {
  const dir = engines.firstPath(projectRoot, 'skillsDir');
  const columns = ['Умение', 'Признак', 'Описание'];
  if (!dir) return { columns, rows: [], dirs: UNKNOWN };
  const tpl = engines.first(projectRoot, 'templateSkills');
  const fromTemplate = Array.isArray(tpl) ? new Set(tpl) : null;
  const names = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
  const rows = names.map((n) => {
    const fm = parseFrontmatter(readIfExists(path.join(dir, n, 'SKILL.md'), ''));
    const d = typeof fm.description === 'string' ? fm.description.replace(/\s+/g, ' ').trim() : '';
    const origin = !fromTemplate ? ORIGIN.unknown : fromTemplate.has(n) ? ORIGIN.core : ORIGIN.project;
    return [n, origin, d.length > 160 ? d.slice(0, 157) + '...' : d];
  });
  return { columns, rows, dirs: names.length };
}

/** Цели с признаком «образ — черновик». */
function readGoalDrafts(projectRoot) {
  const goalsDir = path.join(projectRoot, 'project', 'goals');
  const goals = [];
  if (!fs.existsSync(goalsDir)) return goals;
  for (const d of fs.readdirSync(goalsDir).sort()) {
    const g = readIfExists(path.join(goalsDir, d, 'GOAL.md'), null);
    if (!g) continue;
    goals.push({ id: d, draft: String(parseFrontmatter(g).draft) === 'true' });
  }
  return goals;
}

function readProjectSettings(projectRoot) {
  const raw = readIfExists(projectFile(projectRoot, 'PROJECT.md'), null);
  if (!raw) return { present: false };
  const md = i18n.reader(raw);
  const tpl = md.table('template');
  const thr = md.table('thresholds');
  const skills = readSkills(projectRoot);
  return {
    present: true,
    source: 'project/config/PROJECT.md',
    language: md.inline('language'),
    template: { name: i18n.rowValue(tpl, 'name'), status: i18n.rowValue(tpl, 'status') },
    thresholds: { attempts: i18n.rowValue(thr, 'attempts'), volume: i18n.rowValue(thr, 'volume') },
    release: md.trailingNumber('release'),
    epics: md.table('epics'),
    services: md.table('services'),
    tooling: toolingView(md.table('tooling')),
    references: md.table('references'),
    skills: { columns: skills.columns, rows: skills.rows },
    skillDirs: skills.dirs,
    goals: readGoalDrafts(projectRoot),
  };
}

const NO_ENGINE_SETTINGS = {
  present: false, env: [], hooks: [], nodes: [], skills: [],
  mcp: { project: [], user: [], userProject: [] }, check: { ran: false },
};

function readEngineSettings(projectRoot) {
  const read = engines.first(projectRoot, 'engineSettings');
  const tag = engines.first(projectRoot, 'engine');
  const eng = read ? read(projectRoot) : NO_ENGINE_SETTINGS;
  // описание хука — из шапки его скрипта (как в «Структуре»); нет шапки — нет описания, не выдумка
  const { describe } = require('../structure.cjs');
  const hookDescs = {};
  for (const h of eng.hooks || []) for (const cmd of h.commands) {
    if (!(cmd in hookDescs)) hookDescs[cmd] = describe(path.join(projectRoot, cmd));
  }
  return { ...eng, hookDescs, engine: tag || UNKNOWN, routes: readRoutesCatalog(projectRoot) };
}

module.exports = { readProjectSettings, readEngineSettings };
