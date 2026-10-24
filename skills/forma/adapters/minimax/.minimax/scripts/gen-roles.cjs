'use strict';

/**
 * Генератор зеркала ролей Claude → MiniMax (`.claude/agents/` → `.minimax/agents/`).
 *
 * Механика — та же, что у зеркала Gemini (`gen-gemini-roles.cjs`), с двумя отличиями,
 * обусловленными движком:
 *   • тело роли — копия с перестановкой путей и имён инструментов на мои;
 *   • фронтматтер — мой: модель, инструменты и `uses` — инженерный выбор движка,
 *     сверка паритета его не сравнивает (`role-parity.cjs` режет `^---...---\n`).
 *
 * Запуск: node .minimax/scripts/gen-roles.cjs [--check]
 *   --check — ничего не пишет, только сообщает расхождения (роль, где тело разошлось).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, '.claude', 'agents');
const DST = path.join(ROOT, '.minimax', 'agents');

/**
 * Перестановки путей в теле роли: моя зона — `.minimax/`, закон — `AGENTS.md`.
 *
 * Пути пишутся полными (`.minimax/skills/`, `.minimax/rules/minimax-8.md`), а не «от папки движка»:
 * сверка паритета движков нормализует именно полные пути (по контракту адаптеров), и только они
 * сходятся с эталоном. Папка ролей — исключение: сверка знает и короткую форму (`agents/…`).
 */
const BODY_TRANSFORMS = [
  [/\.claude\/agents\/on-demand\//g, 'agents/on-demand/'],
  [/\.claude\/agents\/run\//g, 'agents/run/'],
  [/\.claude\/agents\/(?=[,`\s)]|$)/g, 'agents/'],
  [/\.claude\/skills\//g, '.minimax/skills/'],
  [/\.claude\/rules\/claude-8\.md/g, '.minimax/rules/minimax-8.md'],
  [/\bclaude-8\.md\b/g, 'minimax-8.md'],
  [/\bCLAUDE\.md\b/g, 'AGENTS.md'],
];

/** Инструменты: имя клона → имя моего рантайма. Порядок важен: длинные первыми. */
const TOOL_MAP = [
  [/mcp__chrome-devtools__[a-z_]+/g, 'mcp_browser'],
  [/\bSendMessage\b/g, 'task_append'],
  [/\bAskUserQuestion\b/g, 'ask_user'],
  [/\bTodoWrite\b/g, 'todowrite'],
  [/\bWebSearch\b/g, 'web_search'],
  [/\bWebFetch\b/g, 'web_fetch'],
  [/\bKillShell\b/g, 'task_stop'],
  [/\bTaskOutput\b/g, 'task_output'],
];

/**
 * Правила движка: те, что меняют СМЫСЛ, а не путь.
 *
 * Чужой тег движка в моей зоне — не опечатка, а ошибка счёта: ядро принимает `claude-code:`,
 * и попытка MiniMax, написанная по чужему шаблону, уехала бы в счёт Клода молча.
 * Правило одно: тег в зоне — мой.
 */
const FILE_RULES = {
  'on-demand/route-choice.md': [[/claude-code:/g, 'minimax:']],
};

/**
 * Зоны записи: куда роль кладёт новый файл. Эти места принадлежат движку, поэтому у моей
 * зоны — свои пути. Чтение общих скриптов (`.claude/scripts/*`) остаётся: это зависимость,
 * названная в §8, а не владение.
 */
const WRITE_PATH_RULES = [
  [/project\/extensions\/claude\//g, 'project/extensions/minimax/'],
  [/\.claude\/settings\.local\.json/g, '.minimax/settings.local.json'],
  [/puts it in `\.claude\/scripts\/`/g, 'puts it in `.minimax/scripts/`'],
  [/never to `\.claude\/scripts\/`/g, 'never to `.minimax/scripts/`'],
];

/** Моя модель: рантайм один, различие «узел / измерение» выражено набором инструментов, а не моделью. */
const MY_MODEL = 'minimax-m3.1-flash';

/**
 * Роли, которые пишет сам движок, а не генератор: их механика — моя (тег движка, журнал
 * вызовов, скрипт вывода строки). Генератор их не трогает, а проверка требует их наличия.
 * Роль Клода с тегом `claude-code:` в моей зоне была бы прямой ошибкой: ядро такой тег
 * принимает, и попытка MiniMax молча уехала бы в счёт Claude.
 */
const OWN_ROLES = new Set(['on-demand/spend-line.md']);

function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!m) return { fm: null, body: text };
  return { fm: m[0], body: text.slice(m[0].length) };
}

function parseFrontmatter(fm) {
  const out = {};
  if (!fm) return out;
  for (const line of fm.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k && !k.startsWith('#')) out[k] = v;
  }
  return out;
}

function mapTools(value) {
  if (!value) return value;
  let out = value;
  for (const [re, to] of TOOL_MAP) out = out.replace(re, to);
  return out;
}

function myFrontmatter(srcFm) {
  const f = parseFrontmatter(srcFm);
  const lines = ['---'];
  if (f.name) lines.push(`name: ${f.name}`);
  if (f.description) lines.push(`description: ${f.description}`);
  lines.push(`model: ${MY_MODEL}`);
  if (f.tier) lines.push(`tier: ${f.tier}`);
  if (f.effort) lines.push(`effort: ${f.effort}`);
  if (f.tools) lines.push(`tools: ${mapTools(f.tools)}`);
  if (f.uses) lines.push(`uses: ${f.uses}`);
  lines.push('---');
  return lines.join('\n') + '\n';
}

function transformBody(body, rel) {
  let out = body.replace(/\r\n/g, '\n');
  for (const [re, to] of BODY_TRANSFORMS) out = out.replace(re, to);
  for (const [re, to] of TOOL_MAP) out = out.replace(re, to);
  for (const [re, to] of WRITE_PATH_RULES) out = out.replace(re, to);
  for (const [re, to] of (FILE_RULES[rel] || [])) out = out.replace(re, to);
  return out;
}

function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else if (e.name.endsWith('.md')) out.push(rel);
  }
  return out;
}

function main() {
  const check = process.argv.includes('--check');
  if (!fs.existsSync(SRC)) {
    console.error(`источник ролей не найден: ${SRC}`);
    process.exit(2);
  }
  const files = walk(SRC);
  const diffs = [];
  const missing = [];
  for (const rel of files) {
    const dstPath = path.join(DST, rel);
    if (OWN_ROLES.has(rel)) {
      // Роль движка: пишется руками, генератор её не трогает — но она обязана быть.
      if (!fs.existsSync(dstPath)) missing.push(rel);
      continue;
    }
    const srcText = fs.readFileSync(path.join(SRC, rel), 'utf8');
    const { fm, body } = splitFrontmatter(srcText);
    const want = myFrontmatter(fm) + transformBody(body, rel);
    if (check) {
      const have = fs.existsSync(dstPath) ? fs.readFileSync(dstPath, 'utf8') : null;
      if (have !== want) diffs.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.writeFileSync(dstPath, want, 'utf8');
  }
  if (check) {
    if (missing.length) {
      console.log('ролей движка нет на месте: ' + missing.join(', '));
      process.exit(1);
    }
    if (diffs.length) {
      console.log(`ролей, чьё тело разошлось с эталоном: ${diffs.length}`);
      for (const d of diffs) console.log('  ' + d);
      process.exit(1);
    }
    console.log(`все ${files.length - OWN_ROLES.size} ролей совпадают с эталоном; ролей движка на месте: ${OWN_ROLES.size}`);
    return;
  }
  console.log(`записано ролей: ${files.length - OWN_ROLES.size} → ${path.relative(ROOT, DST)}; ролей движка: ${OWN_ROLES.size} (не трогаются)`);
}

if (require.main === module) main();

module.exports = { transformBody, myFrontmatter, mapTools, TOOL_MAP, BODY_TRANSFORMS, SRC, DST };
