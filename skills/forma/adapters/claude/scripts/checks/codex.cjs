'use strict';

// Третья среда: Codex. Он читает полный канонический текст Claude по ссылке; его Markdown-файлы — не сокращённые
// копии, а короткие исполнимые адаптеры механики. Поэтому проверяется ссылочная конструкция, а не время правки
// и не отметка «сверено»: изменение тела Claude доступно Codex сразу, а порча ссылки должна падать.
// Находки — сведения (`ctx.info`), не нарушения; проверка ничего не возвращает как нарушение.

const fs = require('fs');
const path = require('path');
const { walk } = require('../../../.forma/dashboard/lib/fs.cjs');

const ROLE_NAMES = ['intent', 'spec', 'kit', 'run', 'core', 'extractor'];
const CLAUDE_ON_DEMAND_DIR = '.claude/agents/on-demand';
const CODEX_ON_DEMAND_DIR = '.codex/roles/on-demand';
const COMPAT = '.codex/CLAUDE-COMPAT.md';
const EIGHT_REL = '.codex/CODEX-8.md';
const CFG_REL = '.codex/config.toml';

const sortedFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : []);
const treeFiles = (dir) => walk(dir).sort();

/** 1. Полнота и исполнимая ссылка: роли в двух видах — определение субагента и адаптер со ссылкой на роль Claude. */
function roleProblems(root) {
  const problems = [];
  for (const role of ROLE_NAMES) {
    const toml = `.codex/agents/${role}.toml`;
    const md = `.codex/roles/${role}.md`;
    if (!fs.existsSync(path.join(root, toml))) problems.push(`${toml}: нет определения субагента`);
    if (!fs.existsSync(path.join(root, md))) { problems.push(`${md}: нет адаптера роли`); continue; }
    const adapter = fs.readFileSync(path.join(root, md), 'utf8');
    if (!adapter.includes(`.claude/agents/${role}.md`)) problems.push(`${md}: нет ссылки на каноническую роль Claude`);
    if (!adapter.includes(COMPAT)) problems.push(`${md}: нет перевода механики через CLAUDE-COMPAT.md`);
  }
  return problems;
}

/** 2а. §8 не подменяет закон и опирается на AGENTS.md. */
function eightProblems(root) {
  const abs = path.join(root, EIGHT_REL);
  if (!fs.existsSync(abs)) return [`${EIGHT_REL}: нет §8 этой среды — роли ссылаются в пустоту`];
  const eight = fs.readFileSync(abs, 'utf8');
  // Своей копии §1–7 быть не должно: закон один, в AGENTS.md.
  const problems = (eight.match(/^#{1,3}\s*(§?\s*)?[1-7][.\s·]/gm) || [])
    .map((m) => `${EIGHT_REL}: похоже на собственную копию раздела закона («${m.trim()}») — §1–7 живут только в AGENTS.md`);
  if (!/AGENTS\.md/.test(eight)) {
    problems.push(`${EIGHT_REL}: не ссылается на AGENTS.md — §8 обязан опираться на общий закон, а не стоять сам по себе`);
  }
  return problems;
}

/** 2б. Конфиг ссылается на AGENTS.md и CODEX-8.md. */
function configProblems(root) {
  const abs = path.join(root, CFG_REL);
  if (!fs.existsSync(abs)) return [`${CFG_REL}: нет конфигурации Codex`];
  const cfg = fs.readFileSync(abs, 'utf8');
  const problems = [];
  if (!/AGENTS\.md/.test(cfg)) problems.push(`${CFG_REL}: developer_instructions не указывает на AGENTS.md`);
  if (!/CODEX-8\.md/.test(cfg)) problems.push(`${CFG_REL}: developer_instructions не указывает на CODEX-8.md`);
  return problems;
}

/** 3. Слой «по требованию» имеет тот же ссылочный контракт, что и роли. */
function onDemandProblems(root) {
  const claudeDir = path.join(root, CLAUDE_ON_DEMAND_DIR);
  const codexDir = path.join(root, CODEX_ON_DEMAND_DIR);
  if (!fs.existsSync(claudeDir)) return [];
  const claudeFiles = sortedFiles(claudeDir);
  if (!fs.existsSync(codexDir)) {
    return [`${CODEX_ON_DEMAND_DIR}/: слоя «по требованию» у Codex нет, у Claude — ${claudeFiles.length}. `
      + 'Закон ссылается на эти файлы по голому имени — узел Codex не найдёт то, на что его послали'];
  }
  const problems = [];
  for (const f of claudeFiles) {
    const dstRel = `${CODEX_ON_DEMAND_DIR}/${f}`;
    const dstAbs = path.join(root, dstRel);
    if (!fs.existsSync(dstAbs)) { problems.push(`${dstRel}: нет у Codex, есть у Claude`); continue; }
    const adapter = fs.readFileSync(dstAbs, 'utf8');
    if (!adapter.includes(`${CLAUDE_ON_DEMAND_DIR}/${f}`)) problems.push(`${dstRel}: нет ссылки на каноническую процедуру Claude`);
    if (!adapter.includes(COMPAT)) problems.push(`${dstRel}: нет перевода механики через CLAUDE-COMPAT.md`);
  }
  for (const f of sortedFiles(codexDir)) {
    if (!claudeFiles.includes(f)) problems.push(`${CODEX_ON_DEMAND_DIR}/${f}: есть у Codex, нет у Claude`);
  }
  return problems;
}

/** Навык `name` из .claude/skills/ доступен в .agents/skills/ — тем же составом и содержанием. */
function skillMirrorProblems(root, name) {
  const source = path.join(root, '.claude', 'skills', name);
  const target = path.join(root, '.agents', 'skills', name);
  if (!fs.existsSync(target)) return [`.agents/skills/${name}: нет зеркала навыка Claude`];
  const sourceFiles = treeFiles(source);
  if (sourceFiles.join('\n') !== treeFiles(target).join('\n')) {
    return [`.agents/skills/${name}: состав файлов расходится с .claude/skills/${name}`];
  }
  for (const rel of sourceFiles) {
    if (!fs.readFileSync(path.join(source, rel)).equals(fs.readFileSync(path.join(target, rel)))) {
      return [`.agents/skills/${name}/${rel}: содержание расходится с Claude-источником`];
    }
  }
  return [];
}

/** 4. Навыки Claude доступны через штатный путь Codex .agents/skills. */
function skillProblems(root) {
  const dir = path.join(root, '.claude', 'skills');
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  return names.flatMap((name) => skillMirrorProblems(root, name));
}

function run({ root, info }) {
  // Среды нет — проверять нечего: Codex может не использоваться, это норма.
  if (!fs.existsSync(path.join(root, '.codex'))) return [];
  const notes = [...roleProblems(root), ...eightProblems(root), ...configProblems(root), ...onDemandProblems(root), ...skillProblems(root)];
  if (info) info.push(...notes.map((l) => '    · Codex (сведение, не нарушение): ' + l));
  return [];
}

module.exports = { id: 'codex', since: null, run };
