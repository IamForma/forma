// Структура системы: деревья каталогов — исходник протокола, движок, адаптеры движков (по одному на найденный), проект;
// плюс корень проекта по роду содержимого: настройки, динамика, постоянные данные, произвольное.
//
// Читается с диска на каждой пересборке дашборда — дерево всегда свежее, вызовов модели нет.
// Подписи — из справочника NOTES ниже; папка без подписи всё равно показывается.
'use strict';

const fs = require('fs');
const path = require('path');
const { walk } = require('./lib/fs.cjs');
const engines = require('./lib/engines.cjs');

// Группы ядра; группы адаптеров (поле `structure`) встают между «Движком» и «Проектом».
const CORE_GROUPS = [
  { key: '.forma/protocol', title: 'Протокол · исходник плагина', note: 'отдельный репозиторий: из него ставится плагин в проекты',
    roots: ['.forma/protocol'] },
  { key: 'engine', title: 'Движок', note: 'сама система в этом проекте — без исходника протокола',
    roots: ['AGENTS.md', '.forma/board', { p: '.devtool', dirs: true }, '.forma/skills', '.forma/manual', '.forma/dashboard', '.forma/living'] },
  { key: 'project', title: 'Проект', note: 'из чего состоит проект — первый уровень, без рабочего содержимого',
    roots: [{ p: 'project', max: 2 }] },
];

/** Группы ядра с группами адаптеров перед «Проектом» и подписи каталогов адаптеров. */
function groupsFor(root) {
  const adapterStructures = engines.loadAdapters(root).map((a) => a.structure).filter(Boolean);
  const groups = [...CORE_GROUPS];
  groups.splice(groups.length - 1, 0, ...adapterStructures);
  return { groups, notes: Object.assign({}, ...adapterStructures.map((s) => s.notes || {})) };
}

// Корень проекта по роду содержимого. Статика — только настройки, которые правит человек;
// динамика — то, что ведётся по ходу работы. mixed — в файле настроек пока ведётся динамика
// (что именно — в why); разделение — отдельное решение.
const PROJECT_KINDS = [
  { key: 'static', title: 'Статика · настройки', note: 'правит человек; по ходу работы не меняется', items: [
    { p: 'project/PROJECT.md', note: 'язык, пороги, эпики, маршруты, сервисы, оснастка, доступы',
      mixed: 'статус шаблона, «Версия на сегодня» справочников, реестр оформленных умений' },
    { p: 'project/CONFIG.md', note: 'структура разделов проекта и доски',
      mixed: '«Технические контракты среды», «Лог оснастки»' },
    { p: 'project/ROUTE.md', note: 'шаги маршрута шаблона',
      mixed: '«Пройдено», «Точки выбора»' },
    { p: 'project/SETUP.md', note: 'порядок подготовки проекта' },
  ] },
  { key: 'dynamic', title: 'Динамика · ведение проекта', note: 'статистика и состояние; пишут узлы по ходу работы', items: [
    { p: 'project/JOURNAL.md', note: 'журнал кругов' },
    { p: 'project/VALUE.md', note: 'статистика и ценность по закрытым целям' },
    { p: 'project/ROADMAP.md', note: 'карта целей и их состояние' },
    { p: 'project/goals', note: 'цели: образ, круги, вердикты' },
    { p: 'project/cards', note: 'материал, рождённый карточками' },
    { p: 'project/experience', note: 'опыт: факты среды' },
    { p: '.devtool/features', note: 'доска: карточки' },
  ] },
  { key: 'data', title: 'Постоянные данные', note: 'задаются один раз, дальше только читаются', items: [
    { p: 'project/brief', note: 'якорь: что сказал человек до первой цели' },
    { p: 'project/VARS', note: 'решённые величины и доступы' },
    { p: 'project/reference', note: 'справочные материалы' },
    { p: 'project/design-system', note: 'дизайн-система' },
  ] },
  { key: 'free', title: 'Содержание проекта', note: 'сам продукт — своё у каждого проекта', items: [
    { p: 'project/mockups', note: 'макеты и карта сайта (SITEMAP.md)' },
    { p: 'project/theme', note: 'тема сайта' },
    { p: 'project/prompts', note: 'промпты страниц' },
    { p: 'project/docs', note: 'документация для человека' },
  ] },
];

function projectKinds(root) {
  const known = new Set(PROJECT_KINDS.flatMap(k => k.items.map(i => i.p)));
  const kinds = PROJECT_KINDS.map(k => ({ key: k.key, title: k.title, note: k.note,
    items: k.items.map(i => {
      const n = node(root, i.p, MAX_DEPTH);
      return n && { name: i.p, rel: i.p, desc: n.desc, note: i.note, mixed: i.mixed || null, dir: n.dir, files: n.files };
    }).filter(Boolean) }));
  // всё в корне project/, что не разнесено по родам, — видно отдельно, а не пропадает
  let rest = [];
  try { rest = fs.readdirSync(path.join(root, 'project')).filter(n => !SKIP.has(n)).map(n => 'project/' + n).filter(p => !known.has(p)); } catch { /* нет каталога project/ — неразнесённого нет */ }
  if (rest.length) kinds.push({ key: 'unsorted', title: 'Не разнесено', note: 'в корне project/, род не назначен',
    items: rest.map(p => { const n = node(root, p, MAX_DEPTH); return { name: p, note: null, mixed: null, dir: n.dir, files: n.files }; }) });
  return kinds;
}

const NOTES = {
  'AGENTS.md': 'закон §1–7: пять узлов, маршрут, пороги, запреты',
  '.forma/protocol': 'исходник протокола — отдельный репозиторий',
  '.forma/protocol/templates': 'шаблоны проектов',
  '.forma/protocol/skills': 'скиллы, поставляемые с протоколом',
  '.forma/board': 'ядро доски: создание и проверка карточек',
  '.forma/skills': 'интервью-скиллы ядра, доставляются в каталог скиллов адаптера',
  '.forma/manual': 'руководство по протоколу',
  '.forma/manual/ru': 'руководство, русская версия',
  '.forma/manual/en': 'руководство, английский подлинник',
  '.forma/dashboard': 'дашборд: сбор данных и страница',
  '.forma/living': 'живые данные: графы, журнал изменений, проверки',
  '.forma/living/graphs': 'графы знаний',
  'project': 'материал проекта',
  'project/brief': 'якорь: что сказал человек до первой цели',
  'project/goals': 'цели и их образы',
  'project/cards': 'материал, рождённый карточками',
  'project/design-system': 'дизайн-система',
  'project/mockups': 'макеты',
  'project/adr': 'журнал решений',
  'project/VARS': 'доступы к сайту',
  'project/PROJECT.md': 'пороги, эпики, маршруты, внешние сервисы',
  'project/JOURNAL.md': 'журнал циклов',
  '.devtool': 'доска: каталоги статусов; карточки в них — проект',
  '.devtool/features': 'карточки проекта: в работе и done/',
  '.devtool/features/done': 'принятые карточки',
};

const SKIP = new Set(['.git', 'node_modules', '.cache', 'temp', '__pycache__', '.github']);
const MAX_DEPTH = 3;       // глубже — только счётчик файлов
const MAX_CHILDREN = 40;   // в одной папке; остаток — одной строкой

// Описание из самого файла: description во frontmatter, шапка-комментарий скрипта, первый заголовок .md.
function describe(abs) {
  let t;
  try { const fd = fs.openSync(abs, 'r'); const b = Buffer.alloc(2048); const n = fs.readSync(fd, b, 0, 2048, 0); fs.closeSync(fd); t = b.toString('utf8', 0, n); } catch { return null; }
  t = t.replace(/^\uFEFF/, '').replace(/^#!.*\r?\n/, '');
  const fm = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm) { const d = fm[1].match(/^description:\s*(.+)$/m); if (d) return d[1].replace(/^["']|["']$/g, '').trim().slice(0, 300); }
  if (/\.(cjs|js|mjs|sh|py)$/.test(abs)) {
    const c = t.split(/\r?\n/).filter(l => /^\s*(\/\/|#|\*|\/\*)/.test(l) && !/use strict/.test(l)).slice(0, 3)
      .map(l => l.replace(/^\s*(\/\/+|#+|\/\*+|\*+\/?)\s?/, '').trim()).filter(Boolean).join(' ');
    return c ? c.slice(0, 300) : null;
  }
  if (/\.md$/.test(abs)) { const h = t.replace(/^---[\s\S]*?---\s*/, '').match(/^#\s+(.+)$/m); return h ? h[1].trim().slice(0, 200) : null; }
  return null;
}

function countFiles(abs) {
  return walk(abs, { symlinks: true, tolerant: true, skip: (e) => SKIP.has(e.name) }).length;
}

// opts.dirs — только каталоги (скелет, без рабочих файлов); opts.max — своя глубина раскрытия.
function node(root, rel, depth, opts = {}) {
  const abs = path.join(root, rel);
  let st;
  try { st = fs.statSync(abs); } catch { return null; }
  const name = path.basename(rel);
  const note = ((opts.notes || NOTES)[rel.split(path.sep).join('/')]) || null;
  const relp = rel.split(path.sep).join('/');
  if (!st.isDirectory()) return { name, note, dir: false, rel: relp, desc: describe(abs), size: st.size, mtime: st.mtime.toISOString().slice(0, 10) };
  const out = { name, note, dir: true, rel: relp, files: countFiles(abs), mtime: st.mtime.toISOString().slice(0, 10) };
  if (depth >= (opts.max || MAX_DEPTH)) return out;
  let entries = [];
  try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { /* каталога нет — пустой список */ }
  entries = entries.filter(e => !SKIP.has(e.name) && (!opts.dirs || e.isDirectory()))
    .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name, 'ru'));
  out.children = entries.slice(0, MAX_CHILDREN).map(e => node(root, path.join(rel, e.name), depth + 1, opts)).filter(Boolean);
  if (entries.length > MAX_CHILDREN) out.more = entries.length - MAX_CHILDREN;
  return out;
}

// Род каждого пути по PROJECT_KINDS — им подсвечено дерево «Проекта».
function markKinds(n, rel) {
  const it = PROJECT_KINDS.find(k => k.items.some(i => i.p === rel));
  if (it) { n.kind = it.key; const i = it.items.find(x => x.p === rel); if (i.mixed) n.mixed = i.mixed; }
  (n.children || []).forEach(ch => markKinds(ch, rel + '/' + ch.name));
}

// Файлы, где ведутся настройки. who: human — правит человек; nodes — ведут узлы; secret — значения не показываются (запрет 15).
const SETTINGS_FILES = [
  { p: 'project/PROJECT.md', who: 'human', note: 'язык, пороги, эпики, маршруты, внешние сервисы, оснастка' },
  { p: 'project/CONFIG.md', who: 'human', note: 'структура разделов проекта и доски' },
  { p: 'project/ROUTE.md', who: 'human', note: 'шаги маршрута шаблона' },
  { p: 'project/SETUP.md', who: 'human', note: 'порядок подготовки проекта' },
  { p: 'project/VARS', who: 'human', note: 'решённые величины и доступы к сайту (credentials.md — секреты, только по имени)' },
  { p: 'AGENTS.md', who: 'human', note: 'закон §1–7, общий для всех движков' },
  { p: '.claude/settings.json', who: 'human', note: 'Claude Code: права, хуки, модель' },
  { p: '.claude/hooks', who: 'human', note: 'хуки: старт сессии, защита от удаления, проверка карточек' },
  { p: '.mcp.json', who: 'human', note: 'подключения MCP-серверов' },
  { p: '.env', who: 'secret', note: 'ключи и токены окружения; в дашборде — только имя файла' },
  { p: '.forma/living/checks.json', who: 'nodes', note: 'проверки: с какой даты действует какое правило' },
];

function settingsFiles(root) {
  return SETTINGS_FILES.map(f => {
    const n = node(root, f.p, 99, { max: 1 });
    if (!n) return { rel: f.p, name: f.p, who: f.who, note: f.note, exists: false };
    return { rel: f.p, name: f.p, who: f.who, note: f.note, exists: true, dir: n.dir, files: n.files, size: n.size,
      mtime: n.mtime, desc: f.who === 'secret' ? null : n.desc };
  });
}

function buildStructure(root) {
  const { groups: defs, notes } = groupsFor(root);
  const allNotes = { ...NOTES, ...notes };
  const groups = defs.map(g => ({
    key: g.key, title: g.title, note: g.note,
    roots: g.roots.map(r => {
      if (typeof r === 'string') return node(root, r, 1, { notes: allNotes });
      // dirs — скелет каталога без рабочих файлов; max — раскрыть только до этой глубины
      return node(root, r.p, 1, { dirs: r.dirs, max: r.max, notes: allNotes });
    }).filter(Boolean),
  }));
  groups.filter(g => g.key === 'project').forEach(g => g.roots.forEach(r => markKinds(r, r.name)));
  return { groups, settingsFiles: settingsFiles(root), projectKinds: projectKinds(root), legend: PROJECT_KINDS.map(k => ({ key: k.key, title: k.title })) };
}

module.exports = { buildStructure, describe };

if (require.main === module) {
  const s = buildStructure(path.resolve(__dirname, '..', '..'));
  for (const k of s.projectKinds) console.log(k.title + ": " + k.items.map(i => i.name + (i.mixed ? " [смешано]" : "")).join(", "));
  for (const g of s.groups) console.log(g.title + ': ' + g.roots.map(r => r.name + (r.dir ? ` (${r.files})` : '')).join(', '));
}
