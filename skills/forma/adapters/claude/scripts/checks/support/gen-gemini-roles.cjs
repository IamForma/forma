'use strict';

// Генератор зеркала ролей Claude → Gemini (`.claude/agents/` → `.agents/plugins/forma/agents/`).
// Правила выведены байт-в-байт из текущего (уже синхронного) зеркала.
// Фронтматтер (model/effort/tools/skills) не генерируется: он инженерный выбор под возможности
// движка, role-parity.cjs сам исключает его из сверки (normalizeText режет `^---...---\n`).
// Генератор трогает только тело файла и сохраняет фронтматтер, уже стоящий в файле назначения.

const fs = require('fs');
const path = require('path');

const CLAUDE_AGENTS_DIR = '.claude/agents';
const GEMINI_AGENTS_DIR = '.agents/plugins/forma/agents';

// Роль (с фронтматтером `model:`) получает суффикс заголовка « (Gemini Engine)» и полный набор
// подстановок путей. On-demand (без фронтматтера) получает только подстановку собственной папки.
const ROLE_TRANSFORMS = [
  [/\.claude\/agents\/on-demand\//g, 'agents/on-demand/'],
  [/\.claude\/agents\/run\//g, 'agents/run/'],
  [/\.claude\/agents\/\*\.md/g, 'agents/*.md'],
  [/\.claude\/agents\/(?=[,`\s)]|$)/g, 'agents/'],
  [/\.claude\/skills\//g, '.agents/skills/'],
];
const ON_DEMAND_TRANSFORMS = [
  [/\.claude\/agents\/on-demand\//g, 'agents/on-demand/'],
];

// Строки-исключения: ссылка на конкретный файл (не на «мою папку ролей» вообще) или документация
// самого устройства двух зеркал сразу — регекс не умеет отличить это от общей ссылки на папку,
// поэтому исключение явное, по файлу и точной подстроке. Расширять только по найденному в diff.
const PROTECTED_LITERALS = {
  'core.md': ['`.claude/skills/*/SKILL.md`'],
  'spec.md': ['agents in `.claude/agents/`, skills in `.claude/skills/`'],
  [path.join('run', 'run-image-series.md')]: ["(`~/.claude/skills/`, not `.claude/skills/` of this project)"],
};

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

/** Список файлов-ролей (относительно `.claude/agents/`): корневые шесть + `run/*.md`. */
function listRoleFiles(root) {
  const base = path.join(root, CLAUDE_AGENTS_DIR);
  const top = fs.readdirSync(base).filter((f) => f.endsWith('.md'));
  const runDir = path.join(base, 'run');
  const run = fs.existsSync(runDir) ? fs.readdirSync(runDir).filter((f) => f.endsWith('.md')).map((f) => path.join('run', f)) : [];
  return [...top, ...run];
}

/** Список on-demand файлов (относительно `.claude/agents/on-demand/`). */
function listOnDemandFiles(root) {
  const dir = path.join(root, CLAUDE_AGENTS_DIR, 'on-demand');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
}

/** Сгенерированное тело для одной роли; фронтматтер берётся из текущего файла назначения (не создаётся). */
function renderRole(root, relFile) {
  const claudeAbs = path.join(root, CLAUDE_AGENTS_DIR, relFile);
  const geminiAbs = path.join(root, GEMINI_AGENTS_DIR, relFile);
  const claudeRaw = fs.readFileSync(claudeAbs, 'utf8');
  const { body } = splitFrontmatter(claudeRaw);
  const genBody = transformBody(body, ROLE_TRANSFORMS, true, PROTECTED_LITERALS[relFile]);
  if (!fs.existsSync(geminiAbs)) {
    return { ok: false, reason: 'missing_dest_frontmatter', content: null };
  }
  const destRaw = fs.readFileSync(geminiAbs, 'utf8').replace(/\r\n/g, '\n');
  const { fm: destFm } = splitFrontmatter(destRaw);
  if (!destFm) return { ok: false, reason: 'dest_has_no_frontmatter', content: null };
  return { ok: true, content: destFm + genBody };
}

/** Сгенерированный on-demand файл: либо побайтовая копия (файл в исключениях), либо с подстановкой пути. */
function renderOnDemand(root, file) {
  const claudeAbs = path.join(root, CLAUDE_AGENTS_DIR, 'on-demand', file);
  const claudeRaw = fs.readFileSync(claudeAbs, 'utf8').replace(/\r\n/g, '\n');
  if (ON_DEMAND_EXCLUDE.has(file)) return { ok: true, content: claudeRaw };
  const content = transformBody(claudeRaw, ON_DEMAND_TRANSFORMS, false, PROTECTED_LITERALS[file]);
  return { ok: true, content };
}

/** Все пары с их генерируемым содержимым и состоянием относительно диска. `kind`: role|on-demand. */
function planAll(root) {
  const plan = [];
  for (const relFile of listRoleFiles(root)) {
    const geminiRel = path.join(GEMINI_AGENTS_DIR, relFile);
    const gen = renderRole(root, relFile);
    plan.push({ kind: 'role', relFile, geminiRel, gen });
  }
  for (const file of listOnDemandFiles(root)) {
    const geminiRel = path.join(GEMINI_AGENTS_DIR, 'on-demand', file);
    const gen = renderOnDemand(root, file);
    plan.push({ kind: 'on-demand', relFile: path.join('on-demand', file), geminiRel, gen });
  }
  return plan;
}

/** Статус одной записи плана против диска: synced|drift|would_create|problem. */
function statusOf(root, entry) {
  if (!entry.gen.ok) return { status: 'problem', detail: entry.gen.reason };
  const destAbs = path.join(root, entry.geminiRel);
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
    const destAbs = path.join(root, entry.geminiRel);
    if (!dryRun) {
      fs.writeFileSync(destAbs, matchEol(entry.gen.content, destAbs), 'utf8');
    }
    written.push({ relFile: entry.relFile, was: res.status });
  }
  return { written, unchanged, problems };
}

module.exports = { planAll, checkAll, applyAll, renderRole, renderOnDemand, CLAUDE_AGENTS_DIR, GEMINI_AGENTS_DIR };
