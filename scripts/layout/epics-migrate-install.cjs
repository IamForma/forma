#!/usr/bin/env node
// Миграция установленного проекта на новые коды и имена девяти видов цели (эпиков).
// Кладётся в протокол вместе с epics-lib.cjs, epics-engine.cjs и epics-migration.json; вызывается установкой
// при обновлении шаблона проекта, ОДИН раз, если проект ещё на старых кодах. Файл не знает ни одного проекта:
// корень и данные приходят аргументами.
//
//   node epics-migrate-install.cjs --check [--root <корень>]            # состояние: old | new | mixed | none
//   node epics-migrate-install.cjs [--dry] [--root <корень>]            # сухой прогон: что изменится (по умолчанию)
//   node epics-migrate-install.cjs --apply [--root <корень>] [--allow-dirty]
//   node epics-migrate-install.cjs --rollback <каталог журнала> [--root <корень>]
//   node epics-migrate-install.cjs --build-data <epics-map.json> [--out <epics-migration.json>]   # для сборки протокола
//
// Что делает --apply: содержимое файлов по якорным правилам (метки goal-<код>, каталоги 0N-<код>, таблица эпиков,
// «N. Имя»), затем git mv каталогов мануала и целей. Журнал и копии исходных файлов — в .forma/living/migrations/.
// Чего не делает: не трогает историю git, архив карточек, макеты, зоны других движков; тексты, где старое имя
// стоит без якоря («Входящие», «Ядро» …), остаются — отчёт перечисляет их человеку.
// Коды выхода: 0 готово или делать нечего · 1 нужна миграция (--check) · 2 стоп (смешанное состояние, грязное дерево, ошибка).
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./epics-lib.cjs');
const engine = require('./epics-engine.cjs');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const say = (o, code) => { console.log(JSON.stringify(o)); process.exit(code); };

// ---- сборка данных миграции из карты проекта (запускает сопровождающий протокола, не установка) ----
if (opt('--build-data')) {
  const src = JSON.parse(fs.readFileSync(path.resolve(opt('--build-data')), 'utf8'));
  // слои, которых установка не правит: копии, материалы проекта, кэши, чужие движки, связанное с сайтом.
  // Остаются в списке как mode none — чтобы файл не упал в общий слой «root-other» и порядок сопоставления сохранился.
  const frozen = new Set(['worktree-copy', 'dashboard-cache', 'living-graphs', 'other-engines', 'protocol-clone', 'theme-site-coupled']);
  const data = {
    version: 1,
    kinds: src.kinds.map((k) => ({ n: k.n, old: k.old, new: k.new })),
    markers: src.markers,
    layers: src.layers.filter((l) => !/^\^project\/cards\/card-/.test(l.test)).map(({ id, test, mode, wave }) => frozen.has(id) ? { id, test, mode: 'none' } : { id, test, mode, wave }),
    paths: { templates: src.paths.templates.filter((t) => !t.from.startsWith('.forma/protocol/')), expectedCount: 27 },
    ruleTemplates: src.ruleTemplates,
    tests: src.tests,
  };
  const out = path.resolve(opt('--out', path.join(__dirname, 'epics-migration.json')));
  // ловушки несут имя карточки-примера: в протоколе оно нейтральное
  fs.writeFileSync(out, JSON.stringify(data, null, 1).replace(new RegExp('card-25' + '0', 'g'), 'card-006'));
  say({ status: 'ok', out, kinds: data.kinds.length, layers: data.layers.length, rules: data.ruleTemplates.length, tests: data.tests.length }, 0);
}

const root = path.resolve(opt('--root', process.cwd()));
const dataFile = path.resolve(opt('--data', path.join(__dirname, 'epics-migration.json')));
if (!fs.existsSync(dataFile)) say({ status: 'stop', error: 'нет файла данных миграции: ' + dataFile }, 2);
const map = lib.loadMap(dataFile);
const rules = lib.compile(map);
const exists = (rel) => fs.existsSync(path.join(root, rel));

// ---- состояние проекта ----
function state() {
  const found = { old: [], new: [] };
  for (const k of map.kinds) {
    for (const [side, code] of [['old', k.old.code], ['new', k.new.code]]) {
      if (exists(`project/goals/goal-${code}`)) found[side].push(`project/goals/goal-${code}`);
      for (const lang of ['ru', 'en']) if (exists(`.forma/manual/${lang}/0${k.n}-${code}`)) found[side].push(`.forma/manual/${lang}/0${k.n}-${code}`);
    }
  }
  const proj = path.join(root, 'project', 'config', 'PROJECT.md');
  if (fs.existsSync(proj)) {
    const codes = new Set();
    for (const ln of fs.readFileSync(proj, 'utf8').split('\n')) { const m = ln.match(/^\|\s*`([^`]+)`\s*\|/); if (m) codes.add(m[1]); }
    for (const k of map.kinds) { if (codes.has(k.old.code)) found.old.push('PROJECT.md: ' + k.old.code); if (codes.has(k.new.code)) found.new.push('PROJECT.md: ' + k.new.code); }
  }
  const st = found.old.length && found.new.length ? 'mixed' : found.old.length ? 'old' : found.new.length ? 'new' : 'none';
  return { st, found };
}

if (flag('--check')) {
  const s = state();
  say({ status: s.st === 'old' ? 'work' : s.st === 'mixed' ? 'stop' : 'ok', state: s.st, old: s.found.old.length, new: s.found.new.length }, s.st === 'old' ? 1 : s.st === 'mixed' ? 2 : 0);
}

if (opt('--rollback')) {
  const rb = engine.rollback(root, path.resolve(opt('--rollback')), flag('--force'));
  say({ status: rb.problems.length ? 'stop' : 'ok', rollback: true, files: rb.files, moves: rb.moves, problems: rb.problems.slice(0, 10) }, rb.problems.length ? 2 : 0);
}

// ---- сухой прогон и запись ----
const bad = engine.traps(map, rules);
if (bad.length) say({ status: 'stop', error: 'самопроверка регэкспов красная', failed: bad.length, first: bad.slice(0, 3) }, 2);
const s = state();
if (s.st === 'mixed') say({ status: 'stop', error: 'проект в смешанном состоянии: есть и старые, и новые коды — разберите вручную', old: s.found.old.slice(0, 8), new: s.found.new.slice(0, 8) }, 2);
if (s.st !== 'old') say({ status: 'ok', state: s.st, note: s.st === 'new' ? 'проект уже на новых кодах' : 'девяти видов цели в проекте нет — делать нечего' }, 0);

const plan = engine.buildPlan(root, map, rules, null);
const summary = { mode: flag('--apply') ? 'apply' : 'dry', state: s.st, files: plan.changes.length, replacements: plan.changes.reduce((a, c) => a + c.n, 0), moves: plan.moves.length, confirms: plan.confirms.length, problems: plan.problems.length };
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const jdir = path.resolve(opt('--journal-dir', path.join(root, '.forma', 'living', 'migrations', 'epics-' + stamp)));

if (!flag('--apply')) {
  fs.mkdirSync(jdir, { recursive: true });
  const rep = path.join(jdir, 'dry-report.json');
  fs.writeFileSync(rep, JSON.stringify({ ...summary, problemsList: plan.problems, confirmsList: plan.confirms, moveList: plan.moves, fileList: plan.changes.map((c) => ({ rel: c.rel, layer: c.layer, n: c.n })) }, null, 1));
  say({ status: plan.problems.length ? 'stop' : 'ok', ...summary, report: engine.posix(path.relative(root, rep)) }, plan.problems.length ? 2 : 0);
}

if (plan.problems.length) say({ status: 'stop', ...summary, error: 'в плане есть проблемы, запись отменена', problems: plan.problems.slice(0, 10) }, 2);
if (!flag('--allow-dirty')) {
  const dirty = engine.dirtyPaths(root);
  const hit = [...plan.changes.map((c) => c.rel), ...plan.moves.map((m) => m.from)].filter((p) => dirty.has(p) || [...dirty].some((d) => d.startsWith(p + '/')));
  if (hit.length) say({ status: 'stop', ...summary, error: 'правки в рабочем дереве пересекаются с планом (закоммитьте или --allow-dirty)', dirty: hit.slice(0, 10) }, 2);
}
const journal = engine.applyPlan(root, plan, jdir, { only: null, noMoves: false });
fs.writeFileSync(path.join(jdir, 'report.json'), JSON.stringify({ ...summary, confirmsList: plan.confirms, moveList: plan.moves }, null, 1));

// после записи: проверка доски проекта, если она есть (метки goal-* ↔ каталоги ↔ эпики)
let board = null;
const boardScript = path.join(root, '.forma', 'board', 'check-board.cjs');
if (fs.existsSync(boardScript)) {
  try { execFileSync('node', [boardScript], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }); board = 0; }
  catch (e) { board = String(e.stdout || '').split('\n').filter((l) => l.trim()).length; }
}
say({ status: board ? 'work' : 'ok', ...summary, movesDone: journal.moves.length, boardProblems: board, journal: engine.posix(path.relative(root, jdir)), review: plan.confirms.length ? 'строки с подтверждением — в report.json (confirmsList)' : 'нет' }, board ? 1 : 0);
