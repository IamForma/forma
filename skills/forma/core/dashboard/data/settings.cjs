'use strict';

/**
 * Вкладки «Проект» и «Движок»: только чтение. «Проект» — `project/PROJECT.md` и `GOAL.md` целей;
 * «Движок» — настройки движка, которые читает адаптер (`engineSettings`), он же держит запрет 15 (у секретов
 * только имя), плюс каталог маршрутов. Нет адаптера — настройки не найдены, а не пустые.
 */

const fs = require('fs');
const path = require('path');
const { readIfExists } = require('../lib/fs.cjs');
const { parseFrontmatter } = require('../lib/card.cjs');
const engines = require('../lib/engines.cjs');
const { readRoutesCatalog } = require('./routes.cjs');

const { UNKNOWN } = engines;

const clean = (s) => s.replace(/`/g, '').trim();
const tableCells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map(clean);

/**
 * Читатель разделов PROJECT.md. Раздел — абзац, начинающийся с **Имя**; таблица раздела — первая после него.
 * Комментарии `<!-- -->` в разбор не идут.
 */
function projectMdReader(raw) {
  const lines = raw.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const secStart = (label) => lines.findIndex((l) => l.startsWith('**' + label));
  const inline = (label) => {
    const l = lines[secStart(label)];
    if (!l) return null;
    const m = l.replace(/\*\([^)]*\)\*/g, '').match(/:\s*(.+)$/);
    return m ? clean(m[1].replace(/\.\s.*$/, '').replace(/\.$/, '')) : null;
  };
  const table = (label) => {
    const i = secStart(label);
    if (i < 0) return null;
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('|')) {
      if (lines[j].startsWith('**') || lines[j].startsWith('---')) return { columns: [], rows: [] };
      j++;
    }
    const columns = j < lines.length ? tableCells(lines[j]) : [];
    const rows = [];
    for (let k = j + 2; k < lines.length && lines[k].startsWith('|'); k++) {
      const r = tableCells(lines[k]);
      if (r.some((c) => c)) rows.push(r);
    }
    return { columns, rows };
  };
  const trailingNumber = (label) => {
    const l = lines[secStart(label)];
    const m = l && l.match(/:\s*(\d+)\s*$/);
    return m ? m[1] : null;
  };
  return { inline, table, trailingNumber };
}

/** Второй столбец строки таблицы, у которой первый столбец подходит под `test`; нет таблицы или строки — `null`. */
function tableValue(table, test) {
  const r = table && table.rows.find((x) => test(x[0]));
  return r ? r[1] : null;
}

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
  const raw = readIfExists(path.join(projectRoot, 'project', 'PROJECT.md'), null);
  if (!raw) return { present: false };
  const md = projectMdReader(raw);
  const tpl = md.table('Шаблон проекта');
  const thr = md.table('Пороги');
  const skills = readSkills(projectRoot);
  return {
    present: true,
    source: 'project/PROJECT.md',
    language: md.inline('Язык проекта'),
    template: { name: tableValue(tpl, (k) => k === 'Имя'), status: tableValue(tpl, (k) => k === 'Статус') },
    thresholds: { attempts: tableValue(thr, (k) => /^Заходов/.test(k)), volume: tableValue(thr, (k) => /^Объём/.test(k)) },
    release: md.trailingNumber('Выпуск протокола'),
    epics: md.table('Эпики проекта'),
    services: md.table('Внешние сервисы'),
    tooling: toolingView(md.table('Оснастка узлов')),
    references: md.table('Справочники проекта'),
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
