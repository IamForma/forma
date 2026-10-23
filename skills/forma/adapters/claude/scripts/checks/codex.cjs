'use strict';

// Третья среда: Codex. Он читает полный канонический текст Claude по ссылке; его Markdown-файлы — не сокращённые
// копии, а короткие исполнимые адаптеры механики. Поэтому проверяется ссылочная конструкция, а не время правки
// и не отметка «сверено»: изменение тела Claude доступно Codex сразу, а порча ссылки должна падать.
// Находки — сведения (`ctx.info`), не нарушения; проверка ничего не возвращает как нарушение.

const fs = require('fs');
const path = require('path');
const { walk } = require('../../../.forma/dashboard/lib/fs.cjs');
const { isDormant } = require('./support/dormant.cjs');
const roots = require('./support/engine-roots.cjs');
const engines = require('../../../.forma/dashboard/lib/engines.cjs');

const ROLE_NAMES = ['intent', 'spec', 'kit', 'run', 'core', 'extractor'];
const ENGINE_ID = 'codex';
const SKILLS_MIRROR_ID = 'gemini'; // Codex читает скиллы из каталога, что объявил адаптер этого движка

/**
 * Пути проверки: у адаптера Codex — из его `sources`/`engineRulesFile`; адаптера нет, но папка есть — по соглашению
 * engines.cjs от имени движка. Источник ролей и каталог скиллов — из адаптеров своего и зеркального движков.
 * null — Codex не подключён или не с чем сверять.
 */
function ctxOf(root) {
  const mine = roots.find(root, ENGINE_ID);
  const dir = mine ? mine.dir : '.' + ENGINE_ID;
  if (!fs.existsSync(path.join(root, dir))) return null;
  const base = roots.own(root);
  if (!base) return null;
  const src = mine ? mine.src : engines.sourcesOf({ id: ENGINE_ID, dir });
  const rules = (mine && mine.adapter.engineRulesFile) || `${dir}/${ENGINE_ID.toUpperCase()}-8.md`;
  const mirror = roots.find(root, SKILLS_MIRROR_ID);
  const rolesDir = mine && mine.adapter.sources ? mine.adapter.sources.rolesDir : `${dir}/roles`; // адаптеры Codex — короткие, рядом с определениями субагентов
  return {
    id: ENGINE_ID,
    name: ENGINE_ID.charAt(0).toUpperCase() + ENGINE_ID.slice(1),
    dir,
    baseRoles: base.src.rolesDir,
    baseOnDemand: base.src.onDemandRolesDir || `${base.src.rolesDir}/on-demand`,
    baseSkills: base.src.skillsDir,
    skillsTarget: (mine && mine.adapter.sources && mine.adapter.sources.skillsDir) || (mirror ? mirror.src.skillsDir : null),
    tomlDir: `${dir}/agents`,
    rolesDir,
    onDemandDir: `${rolesDir}/on-demand`,
    compat: `${dir}/${base.id.toUpperCase()}-COMPAT.md`,
    eight: rules,
    cfg: `${dir}/config.toml`,
    _src: src,
  };
}

const sortedFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : []);
const treeFiles = (dir) => walk(dir).sort();

/** 1. Полнота и исполнимая ссылка: роли в двух видах — определение субагента и адаптер со ссылкой на роль Claude. */
function roleProblems(root, c) {
  const problems = [];
  for (const role of ROLE_NAMES) {
    const toml = `${c.tomlDir}/${role}.toml`;
    const md = `${c.rolesDir}/${role}.md`;
    if (!fs.existsSync(path.join(root, toml))) problems.push(`${toml}: нет определения субагента`);
    if (!fs.existsSync(path.join(root, md))) { problems.push(`${md}: нет адаптера роли`); continue; }
    const adapter = fs.readFileSync(path.join(root, md), 'utf8');
    if (!adapter.includes(`${c.baseRoles}/${role}.md`)) problems.push(`${md}: нет ссылки на каноническую роль эталона`);
    if (!adapter.includes(c.compat)) problems.push(`${md}: нет перевода механики через ${path.posix.basename(c.compat)}`);
  }
  return problems;
}

/** 2а. §8 не подменяет закон и опирается на AGENTS.md. */
function eightProblems(root, c) {
  const EIGHT_REL = c.eight;
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
function configProblems(root, c) {
  const CFG_REL = c.cfg;
  const abs = path.join(root, CFG_REL);
  if (!fs.existsSync(abs)) return [`${CFG_REL}: нет конфигурации Codex`];
  const cfg = fs.readFileSync(abs, 'utf8');
  const problems = [];
  if (!/AGENTS\.md/.test(cfg)) problems.push(`${CFG_REL}: developer_instructions не указывает на AGENTS.md`);
  const eightName = path.posix.basename(c.eight);
  if (!cfg.includes(eightName)) problems.push(`${CFG_REL}: developer_instructions не указывает на ${eightName}`);
  return problems;
}

/** 3. Слой «по требованию» имеет тот же ссылочный контракт, что и роли. */
function onDemandProblems(root, c) {
  const CLAUDE_ON_DEMAND_DIR = c.baseOnDemand;
  const CODEX_ON_DEMAND_DIR = c.onDemandDir;
  const COMPAT = c.compat;
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

/** Навык `name` из каталога скиллов эталона доступен в каталоге скиллов Codex — тем же составом и содержанием. */
function skillMirrorProblems(root, c, name) {
  const source = path.join(root, c.baseSkills, name);
  const target = path.join(root, c.skillsTarget, name);
  if (!fs.existsSync(target)) return [`${c.skillsTarget}/${name}: нет зеркала навыка эталона`];
  const sourceFiles = treeFiles(source);
  if (sourceFiles.join('\n') !== treeFiles(target).join('\n')) {
    return [`${c.skillsTarget}/${name}: состав файлов расходится с ${c.baseSkills}/${name}`];
  }
  for (const rel of sourceFiles) {
    if (!fs.readFileSync(path.join(source, rel)).equals(fs.readFileSync(path.join(target, rel)))) {
      return [`${c.skillsTarget}/${name}/${rel}: содержание расходится с источником эталона`];
    }
  }
  return [];
}

/** 4. Навыки Claude доступны через штатный путь скиллов Codex. */
function skillProblems(root, c) {
  if (!c.skillsTarget) return [];
  const dir = path.join(root, c.baseSkills);
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  return names.flatMap((name) => skillMirrorProblems(root, c, name));
}

function run({ root, info }) {
  // Среды нет — проверять нечего: Codex может не использоваться, это норма.
  const c = ctxOf(root);
  if (!c) return [];
  // Спящий режим (`.forma/engines.json`): среда на месте, но не сверяется.
  if (isDormant(root, c.id)) { if (info) info.push(`    · ${c.name}: спящий режим — не сверяется (реестр .forma/engines.json)`); return []; }
  const notes = [...roleProblems(root, c), ...eightProblems(root, c), ...configProblems(root, c), ...onDemandProblems(root, c), ...skillProblems(root, c)];
  if (info) info.push(...notes.map((l) => `    · ${c.name} (сведение, не нарушение): ` + l));
  return [];
}

module.exports = { id: ENGINE_ID, since: null, run };
