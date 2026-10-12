#!/usr/bin/env node
// Уровень доступа Claude Code в проекте: малый | средний | полный (minimal | standard | full).
// Описание уровней — .claude/permission-levels.json. Пишет разрешения в .claude/settings.local.json — файл человека:
// трогает только то, что добавил сам (учёт — .claude/permission-level.state.json); записи человека остаются как есть.
//   node .claude/scripts/permissions-level.cjs <уровень>   — включить уровень (прежний уровень снимается)
//   node .claude/scripts/permissions-level.cjs --show      — текущий уровень и список уровней
//   node .claude/scripts/permissions-level.cjs --off       — снять всё, что добавил скрипт
// Запуск из корня проекта. Переменная окружения PERMISSIONS_ROOT меняет корень (для теста).
'use strict';
const fs = require('fs');
const path = require('path');

const root = process.env.PERMISSIONS_ROOT || process.cwd();
const C = path.join(root, '.claude');
const levelsFile = path.join(C, 'permission-levels.json');
const localFile = path.join(C, 'settings.local.json');
const stateFile = path.join(C, 'permission-level.state.json');

const stop = (m, code = 1) => { console.error('СТОП: ' + m); process.exit(code); };
const readJson = (f, what) => {
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return stop(what + ' — не JSON, поправьте вручную.', 2); }
};
const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n');

const cfg = readJson(levelsFile, '.claude/permission-levels.json');
if (!cfg) stop('нет .claude/permission-levels.json.', 2);

/** Разрешения уровня вместе с унаследованными. */
function resolve(name, seen = []) {
  const l = cfg.levels[name];
  if (!l || seen.includes(name)) return stop('уровень «' + name + '» не описан или зациклен.', 2);
  const base = l.extends ? resolve(l.extends, [...seen, name]) : { allow: [], defaultMode: null };
  return { allow: [...new Set([...base.allow, ...l.allow])], defaultMode: l.defaultMode || base.defaultMode };
}
const canonical = (w) => { const k = String(w || '').trim().toLowerCase(); return cfg.levels[k] ? k : (cfg.aliases || {})[k] || null; };

const state = readJson(stateFile, '.claude/permission-level.state.json') || { level: null, added: [], mode: null };
const local = readJson(localFile, '.claude/settings.local.json') || {};

/** Снимает то, что добавил скрипт; записи человека не трогает. */
function strip() {
  const perm = local.permissions || {};
  if (Array.isArray(perm.allow)) perm.allow = perm.allow.filter((e) => !state.added.includes(e));
  if (state.mode && perm.defaultMode === state.mode) delete perm.defaultMode;
  state.added = []; state.mode = null; state.level = null;
  if (local.permissions) local.permissions = perm;
}
function save() {
  const perm = local.permissions;
  if (perm && Array.isArray(perm.allow) && !perm.allow.length) delete perm.allow;
  if (perm && !Object.keys(perm).length) delete local.permissions;
  fs.mkdirSync(C, { recursive: true });
  writeJson(localFile, local);
  if (state.level) { writeJson(stateFile, state); exclude(); } else if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
}
/** Учёт скрипта личный, как settings.local.json: в git не уходит (локальное исключение .git/info/exclude). */
function exclude() {
  const file = path.join(root, '.git', 'info', 'exclude');
  const line = '.claude/permission-level.state.json';
  try {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (cur.split(/\r?\n/).includes(line)) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, (cur && !cur.endsWith('\n') ? '\n' : '') + line + '\n');
  } catch { /* нет .git — нечего исключать */ }
}

const arg = process.argv[2];
if (!arg || arg === '--help') {
  console.log('Использование: permissions-level.cjs <малый|средний|полный> | --show | --off\n(minimal | standard | full — то же самое)');
  process.exit(arg ? 0 : 2);
}
if (arg === '--show') {
  console.log('Текущий уровень: ' + (state.level || 'не задан скриптом'));
  for (const n of Object.keys(cfg.levels)) console.log(`  ${n === state.level ? '*' : ' '} ${n} — ${cfg.levels[n].about}`);
  process.exit(0);
}
if (arg === '--off') { strip(); save(); console.log('Снято всё, что добавил скрипт. Ваши записи в settings.local.json не тронуты.'); process.exit(0); }

const name = canonical(arg);
if (!name) stop('неизвестный уровень «' + arg + '». Доступны: ' + Object.keys(cfg.levels).join(', ') + '.', 2);
strip();
const { allow, defaultMode } = resolve(name);
local.permissions = local.permissions || {};
const have = Array.isArray(local.permissions.allow) ? local.permissions.allow : [];
const fresh = allow.filter((e) => !have.includes(e)); // что человек уже держит у себя — не наше, не снимется
local.permissions.allow = [...have, ...fresh];
state.added = fresh;
if (defaultMode && !local.permissions.defaultMode) { local.permissions.defaultMode = defaultMode; state.mode = defaultMode; }
state.level = name;
save();
console.log(`Уровень «${name}» включён: добавлено ${fresh.length} разрешений` + (state.mode ? `, режим ${state.mode}` : '') + '.');
console.log('Действует с новой сессии (или после /clear). Файл: .claude/settings.local.json');
