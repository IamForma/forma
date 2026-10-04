'use strict';

/**
 * Общая часть адаптеров для вкладки «Форма»: чтение ролей узлов и каталога ролей Run в виде
 * `{ name, file, model, tier, effort, skills, connectors, toolCount }`.
 * Форматов два: markdown с фронтматтером (Claude, Gemini) и toml (Codex). Какой читать — решает адаптер движка;
 * ядро (`.forma/dashboard/data/forma.cjs`) видит только готовый срез из поля `formaRoles` адаптера (шапка `engines.cjs`).
 * Только показ: опись не хранится, это срез тех же файлов.
 */

const fs = require('fs');
const path = require('path');
const { readJson } = require('./fs.cjs');
const { parseFrontmatter } = require('./card.cjs');

const NODE_ORDER = ['Intent', 'Spec', 'Kit', 'Core']; // Run — отдельно, каталог ролей

/** Инструменты фронтматтера, запятая внутри Bash(...)/mcp-скобок не режет список. */
function splitTools(raw) {
  return String(raw || '').split(/,\s*(?![^()]*\))/).map((s) => s.trim()).filter(Boolean);
}

/** Список скиллов: пусто/`none` → `[]`. */
function splitSkills(raw) {
  const skills = String(raw || '').trim();
  return !skills || skills.toLowerCase() === 'none' ? [] : skills.split(/,\s*/).filter(Boolean);
}

/** Коннекторы MCP среди инструментов: `mcp__<server>__<ability>` → имя сервера. */
function mcpServerNames(tools) {
  const names = new Set();
  for (const t of tools) {
    const parts = t.split('__');
    if (parts[0] === 'mcp' && parts.length >= 3) names.add(parts[1]);
  }
  return [...names];
}

/** Минимальный разбор toml: строковые и числовые значения верхнего уровня и имена таблиц `[a.b]`. */
function parseToml(text) {
  const top = {};
  const tables = [];
  let inTop = true;
  const lines = String(text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const table = line.match(/^\[\[?([^\]]+)\]\]?$/);
    if (table) { inTop = false; tables.push(table[1].trim()); continue; }
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    if (val.startsWith('"""')) { // многострочная строка: пропускаем до закрывающей
      if (!(val.length >= 6 && val.endsWith('"""'))) while (++i < lines.length && !lines[i].includes('"""'));
      if (inTop) top[key] = '';
      continue;
    }
    val = val.replace(/\s+#.*$/, '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (inTop) top[key] = val;
  }
  return { top, tables };
}

/** Имена серверов MCP из файлов `{ file, level }`: ключи `mcpServers` (json) или таблицы `[mcp_servers.<имя>]` (toml). */
function configuredServers(files) {
  const byName = new Map();
  for (const { file, level } of files) {
    let names = [];
    if (file.endsWith('.toml')) {
      if (!fs.existsSync(file)) continue;
      names = parseToml(fs.readFileSync(file, 'utf8')).tables
        .map((t) => t.match(/^mcp_servers\.("?)([^."]+)\1/)).filter(Boolean).map((m) => m[2]);
    } else {
      const j = readJson(file);
      names = j && j.mcpServers ? Object.keys(j.mcpServers) : [];
    }
    for (const n of names) if (!byName.has(n)) byName.set(n, level);
  }
  return byName;
}

/** Карточка коннектора: `{ name, level }` — level null, если сервер не нашёлся ни в одном файле. */
function connectorRows(tools, configured) {
  return mcpServerNames(tools).sort().map((name) => ({ name, level: configured.get(name) || null }));
}

const rel = (root, file) => path.relative(root, file).split(path.sep).join('/');

/** Роль из markdown с фронтматтером; `skillsKey` — ключ со скиллами (`uses` у узлов, `.forma/skills` у ролей Run). */
function mdRoleRow(root, file, name, skillsKey, configured) {
  const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const tools = splitTools(fm.tools);
  return {
    name: name || fm.name || path.basename(file, '.md'),
    file: rel(root, file),
    model: fm.model || null,
    tier: fm.tier || null,
    effort: fm.effort || null,
    skills: fm[skillsKey] === undefined ? null : splitSkills(fm[skillsKey]),
    connectors: connectorRows(tools, configured),
    toolCount: tools.length,
  };
}

/** Роль из toml движка Codex: модель, effort — `model_reasoning_effort`. Скиллов и инструментов в файле нет. */
function tomlRoleRow(root, file, name) {
  const { top } = parseToml(fs.readFileSync(file, 'utf8'));
  return {
    name: name || top.name || path.basename(file, '.toml'),
    file: rel(root, file),
    model: top.model || null,
    tier: null,
    effort: top.model_reasoning_effort || null,
    skills: null,
    connectors: [],
    toolCount: 0,
  };
}

/**
 * Срез по каталогу markdown-ролей: узлы `<rolesDir>/<узел>.md`, роли Run `<rolesDir>/run/*.md`.
 * `mcpFiles` — `[{ file, level }]`. Результат — форма поля `formaRoles`.
 */
function readMdCatalog(root, { title, rolesDir, mcpFiles }) {
  const dir = path.join(root, ...rolesDir.split('/'));
  if (!fs.existsSync(dir)) return { title, nodes: [], runRoles: [], runNote: null, rolesMissing: true };
  const configured = configuredServers(mcpFiles || []);
  const nodes = NODE_ORDER.map((label) => {
    const file = path.join(dir, `${label.toLowerCase()}.md`);
    return fs.existsSync(file) ? mdRoleRow(root, file, label, 'uses', configured) : null;
  }).filter(Boolean);
  const runDir = path.join(dir, 'run');
  const runExists = fs.existsSync(runDir);
  const runRoles = runExists
    ? fs.readdirSync(runDir).filter((f) => f.endsWith('.md')).sort()
      .map((f) => mdRoleRow(root, path.join(runDir, f), null, '.forma/skills', configured))
    : [];
  return { title, nodes, runRoles, runNote: runExists ? null : { key: 'fm.runNote.noDir', vars: { dir: rolesDir } }, rolesMissing: false };
}

/**
 * Срез по каталогу toml-ролей (Codex): пять узлов и `run` — файлы `<agentsDir>/<узел>.toml`.
 * Каталога ролей Run у движка нет — одна карточка `run` и явная пометка в `runNote`.
 */
function readTomlCatalog(root, { title, agentsDir }) {
  const dir = path.join(root, ...agentsDir.split('/'));
  if (!fs.existsSync(dir)) return { title, nodes: [], runRoles: [], runNote: null, rolesMissing: true };
  const row = (label) => {
    const file = path.join(dir, `${label.toLowerCase()}.toml`);
    return fs.existsSync(file) ? tomlRoleRow(root, file, label) : null;
  };
  const run = row('Run');
  return {
    title,
    nodes: NODE_ORDER.map(row).filter(Boolean),
    runRoles: run ? [{ ...run, name: 'run' }] : [],
    runNote: { key: 'fm.runNote.single' },
    rolesMissing: false,
  };
}

module.exports = {
  NODE_ORDER, splitTools, splitSkills, mcpServerNames, parseToml, configuredServers, connectorRows,
  mdRoleRow, tomlRoleRow, readMdCatalog, readTomlCatalog,
};
