'use strict';

// Генератор зеркала ролей эталонного движка в движок-приёмник (папки ролей — из adapters, engines.cjs).
// Правила выведены байт-в-байт из текущего (уже синхронного) зеркала.
// Фронтматтер (model/effort/tools/skills) не генерируется: он инженерный выбор под возможности
// движка, role-parity.cjs сам исключает его из сверки (normalizeText режет `^---...---\n`).
// Генератор трогает только тело файла и сохраняет фронтматтер, уже стоящий в файле назначения.

const fs = require('fs');
const path = require('path');
const roots = require('./engine-roots.cjs');

// Источник — движок, в чьей папке лежит этот скрипт; приёмник — движок зеркала (по id адаптера).
// Папки ролей и скиллов обоих берутся из `sources` их адаптеров (engines.cjs); нет адаптера — зеркала нет, план пуст.
const TARGET_ID = 'gemini';

/** Контекст зеркала для проекта: { from, to, roleTransforms, onDemandTransforms, protectedLiterals } или null. */
function ctxOf(root) {
  const from = roots.own(root);
  const to = roots.find(root, TARGET_ID);
  if (!from || !to || !from.src.rolesDir || !to.src.rolesDir) return null;
  const rel = path.posix.basename(to.src.rolesDir); // как зеркало называет свою папку ролей изнутри
  const re = (s, tail = '') => new RegExp(roots.escapeRe(s) + tail, 'g');
  const R = from.src.rolesDir;
  const K = from.src.skillsDir;
  const tick = '`';
  // Роль (с фронтматтером `model:`) получает суффикс заголовка « (Gemini Engine)» и полный набор
  // подстановок путей. On-demand (без фронтматтера) получает только подстановку собственной папки.
  const onDemand = [[re(`${R}/on-demand/`), `${rel}/on-demand/`]];
  const roleTransforms = [
    ...onDemand,
    [re(`${R}/run/`), `${rel}/run/`],
    [re(`${R}/*.md`), `${rel}/*.md`],
    [re(`${R}/`, '(?=[,`\s)]|$)'), `${rel}/`],
    [re(`${K}/`), `${to.src.skillsDir}/`],
  ];
  // Строки-исключения: ссылка на конкретный файл (не на «мою папку ролей» вообще) или документация
  // самого устройства двух зеркал сразу — регекс не умеет отличить это от общей ссылки на папку,
  // поэтому исключение явное, по файлу и точной подстроке. Расширять только по найденному в diff.
  const protectedLiterals = {
    'core.md': [`${tick}${K}/*/SKILL.md${tick}`],
    'spec.md': [`agents in ${tick}${R}/${tick}, skills in ${tick}${K}/${tick}`],
    [path.join('run', 'run-image-series.md')]: [`(${tick}~/${from.dir}/skills/${tick}, not ${tick}${K}/${tick} of this project)`],
  };
  return { from, to, roleTransforms, onDemandTransforms: onDemand, protectedLiterals };
}

// on-demand файл, который сам документирует устройство зеркала (оба реальных пути названы рядом) —
// копируется побайтово, без единой подстановки.
const ON_DEMAND_EXCLUDE = new Set(['intent-housekeeping.md']);

function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!m) return { fm: null, body: text };
  return { fm: m[0], body: text.slice(m[0].length) };
}

function protect(body, literals) {
  const slots = [];
  let out = body;
  (literals || []).forEach((lit, i) => {
    const token = `\u0000PROT${i}\u0000`;
    if (out.includes(lit)) {
      out = out.split(lit).join(token);
      slots.push([token, lit]);
    }
  });
  return { out, slots };
}

function restore(body, slots) {
  let out = body;
  for (const [token, lit] of slots) out = out.split(token).join(lit);
  return out;
}

function transformBody(body, transforms, addTitleSuffix, literals) {
  let out = body.replace(/\r\n/g, '\n');
  const { out: protectedOut, slots } = protect(out, literals);
  out = protectedOut;
  for (const [re, to] of transforms) out = out.replace(re, to);
  out = restore(out, slots);
  if (addTitleSuffix) {
    out = out.replace(/^(\s*\n)*(# `[^`]+`)(\r?\n)/, (m0, lead, title, nl) => (lead || '') + title + ' (Gemini Engine)' + nl);
  }
  return out;
}

/** Список файлов-ролей (относительно каталога ролей источника): корневые шесть + `run/*.md`. */
function listRoleFiles(root, ctx) {
  const base = path.join(root, ctx.from.src.rolesDir);
  const top = fs.readdirSync(base).filter((f) => f.endsWith('.md'));
  const runDir = path.join(base, 'run');
  const run = fs.existsSync(runDir) ? fs.readdirSync(runDir).filter((f) => f.endsWith('.md')).map((f) => path.join('run', f)) : [];
  return [...top, ...run];
}

/** Список on-demand файлов (относительно `on-demand/` каталога ролей источника). */
function listOnDemandFiles(root, ctx) {
  const dir = path.join(root, ctx.from.src.rolesDir, 'on-demand');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
}

/** Сгенерированное тело для одной роли; фронтматтер берётся из текущего файла назначения (не создаётся). */
function renderRole(root, relFile, ctx = ctxOf(root)) {
  const claudeAbs = path.join(root, ctx.from.src.rolesDir, relFile);
  const geminiAbs = path.join(root, ctx.to.src.rolesDir, relFile);
  const claudeRaw = fs.readFileSync(claudeAbs, 'utf8');
  const { body } = splitFrontmatter(claudeRaw);
  const genBody = transformBody(body, ctx.roleTransforms, true, ctx.protectedLiterals[relFile]);
  if (!fs.existsSync(geminiAbs)) {
    return { ok: false, reason: 'missing_dest_frontmatter', content: null };
  }
  const destRaw = fs.readFileSync(geminiAbs, 'utf8').replace(/\r\n/g, '\n');
  const { fm: destFm } = splitFrontmatter(destRaw);
  if (!destFm) return { ok: false, reason: 'dest_has_no_frontmatter', content: null };
  return { ok: true, content: destFm + genBody };
}

/** Сгенерированный on-demand файл: либо побайтовая копия (файл в исключениях), либо с подстановкой пути. */
function renderOnDemand(root, file, ctx = ctxOf(root)) {
  const claudeAbs = path.join(root, ctx.from.src.rolesDir, 'on-demand', file);
  const claudeRaw = fs.readFileSync(claudeAbs, 'utf8').replace(/\r\n/g, '\n');
  if (ON_DEMAND_EXCLUDE.has(file)) return { ok: true, content: claudeRaw };
  const content = transformBody(claudeRaw, ctx.onDemandTransforms, false, ctx.protectedLiterals[file]);
  return { ok: true, content };
}

/** Все пары с их генерируемым содержимым и состоянием относительно диска. `kind`: role|on-demand. */
function planAll(root) {
  const ctx = ctxOf(root);
  if (!ctx) return []; // нет адаптера источника или приёмника — зеркала нет
  const plan = [];
  for (const relFile of listRoleFiles(root, ctx)) {
    const destRel = path.join(ctx.to.src.rolesDir, relFile);
    const gen = renderRole(root, relFile, ctx);
    plan.push({ kind: 'role', relFile, destRel, gen });
  }
  for (const file of listOnDemandFiles(root, ctx)) {
    const destRel = path.join(ctx.to.src.rolesDir, 'on-demand', file);
    const gen = renderOnDemand(root, file, ctx);
    plan.push({ kind: 'on-demand', relFile: path.join('on-demand', file), destRel, gen });
  }
  return plan;
}

/** Статус одной записи плана против диска: synced|drift|would_create|problem. */
function statusOf(root, entry) {
  if (!entry.gen.ok) return { status: 'problem', detail: entry.gen.reason };
  const destAbs = path.join(root, entry.destRel);
  if (!fs.existsSync(destAbs)) return { status: 'would_create' };
  const destRaw = fs.readFileSync(destAbs, 'utf8').replace(/\r\n/g, '\n');
  return destRaw === entry.gen.content ? { status: 'synced' } : { status: 'drift' };
}

/** `--check`: отчёт без записи. */
function checkAll(root) {
  const plan = planAll(root);
  return plan.map((entry) => ({ entry, res: statusOf(root, entry) }));
}

/** Перевод стиля конца строки файла назначения назад на `\r\n`, если он уже так хранился — запись
 * не навязывает `\n` файлу, который до этого был `\r\n`; содержимое (без учёта EOL) не меняется. */
function matchEol(content, destAbs) {
  if (!fs.existsSync(destAbs)) return content;
  const existing = fs.readFileSync(destAbs, 'utf8');
  const hadCrlf = /\r\n/.test(existing) && !/[^\r]\n/.test(existing.replace(/\r\n/g, ''));
  return hadCrlf ? content.replace(/\n/g, '\r\n') : content;
}

/** `--apply`: пишет расходящиеся файлы (кроме `problem`), остальные не трогает. Идемпотентна. */
function applyAll(root, { dryRun = false } = {}) {
  const plan = planAll(root);
  const written = [];
  const unchanged = [];
  const problems = [];
  for (const entry of plan) {
    const res = statusOf(root, entry);
    if (res.status === 'problem') { problems.push({ relFile: entry.relFile, reason: res.detail }); continue; }
    if (res.status === 'synced') { unchanged.push(entry.relFile); continue; }
    const destAbs = path.join(root, entry.destRel);
    if (!dryRun) {
      fs.writeFileSync(destAbs, matchEol(entry.gen.content, destAbs), 'utf8');
    }
    written.push({ relFile: entry.relFile, was: res.status });
  }
  return { written, unchanged, problems };
}

module.exports = { planAll, checkAll, applyAll, renderRole, renderOnDemand, ctxOf };
