'use strict';

/**
 * Адаптер Gemini (Antigravity) для ядра «Формы»:
 *  - роли узлов и каталог Run для вкладки «Форма»
 *  - transcriptsDir и parseUsage для стенограмм Antigravity
 *  - usageRefresh: выгрузка расхода сессий в .forma/dashboard/.cache/gemini-usage.json
 *  - engineSettings: MCP-серверы, хуки и активные узлы для вкладки «Движок»
 *  - instructionWeight и stepsFromCacheRead для узлов Gemini (gemini-3.8-flash)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

function resolveModule(candidates) {
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function getFormaRolesModule() {
  const p = resolveModule([
    path.resolve(__dirname, '../.forma/dashboard/lib/forma-roles.cjs'),
    path.resolve(__dirname, '../../.forma/dashboard/lib/forma-roles.cjs'),
    path.resolve(__dirname, '../claude/dashboard/lib/forma-roles.cjs'),
    path.resolve(__dirname, '../../claude/dashboard/lib/forma-roles.cjs'),
    path.resolve(process.cwd(), '.forma/dashboard/lib/forma-roles.cjs'),
  ]);
  return require(p);
}

function readJsonSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {}
  return null;
}

const BYTES_PER_TOKEN_LATIN = 4.1;
const BYTES_PER_TOKEN_CYRILLIC = 2.2;

function estimateTokens(text) {
  const cyrillicChars = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const cyrillicBytes = cyrillicChars * 2;
  const totalBytes = Buffer.byteLength(text, 'utf8');
  const latinBytes = Math.max(0, totalBytes - cyrillicBytes);
  return Math.round(latinBytes / BYTES_PER_TOKEN_LATIN + cyrillicBytes / BYTES_PER_TOKEN_CYRILLIC);
}

function weighFile(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return null;
  const text = fs.readFileSync(abs, 'utf8');
  return { file: rel, bytes: Buffer.byteLength(text, 'utf8'), tokens: estimateTokens(text) };
}

function instructionWeight(root = process.cwd()) {
  const commonFiles = ['AGENTS.md', '.agents/rules/gemini-8.md'];
  const common = commonFiles.map((f) => weighFile(root, f)).filter(Boolean);
  const commonTokens = common.reduce((s, f) => s + f.tokens, 0);

  const roleFiles = {
    Intent: '.agents/plugins/forma/agents/intent.md',
    Spec: '.agents/plugins/forma/agents/spec.md',
    Kit: '.agents/plugins/forma/agents/kit.md',
    Run: '.agents/plugins/forma/agents/run.md',
    Core: '.agents/plugins/forma/agents/core.md',
  };

  const byNode = {};
  for (const [node, rel] of Object.entries(roleFiles)) {
    const role = weighFile(root, rel);
    if (!role) continue;
    byNode[node] = {
      model: 'gemini-3.8-flash',
      common: commonTokens,
      role: role.tokens,
      perStep: commonTokens + role.tokens,
      files: [...common.map((f) => f.file), role.file],
    };
  }

  return {
    estimate: true,
    model: 'gemini-3.8-flash',
    note: 'Оценка по эвристике «байт на токен» для gemini-3.8-flash.',
    common: { tokens: commonTokens, files: common },
    byNode,
  };
}

function stepsFromCacheRead(cacheRead, perStep) {
  if (!cacheRead || !perStep) return null;
  return Number((cacheRead / perStep).toFixed(1));
}

function transcriptsDir(root = process.cwd()) {
  const localDir = path.join(root, '.agents', 'transcripts');
  if (fs.existsSync(localDir)) return localDir;

  const home = os.homedir();
  const antigravityBase = process.env.GEMINI_ANTIGRAVITY_DIR || path.join(home, '.gemini', 'antigravity');
  const convDir = path.join(antigravityBase, 'conversations');
  if (fs.existsSync(convDir)) return convDir;

  const brainDir = path.join(antigravityBase, 'brain');
  if (fs.existsSync(brainDir)) return brainDir;

  return null;
}

function parseUsage(step) {
  if (!step) return { tokens_in: null, tokens_out: null, cache_read: null, cache_write: null };
  const u = (step.message && step.message.usage) || step.usage || step;
  const pick = (keys) => {
    for (const k of keys) {
      if (u && u[k] != null && Number.isFinite(Number(u[k]))) return Number(u[k]);
    }
    return null;
  };
  return {
    tokens_in: pick(['tokens_in', 'input_tokens', 'inputTokens', 'promptTokenCount', 'prompt_token_count']),
    tokens_out: pick(['tokens_out', 'output_tokens', 'outputTokens', 'candidatesTokenCount', 'candidates_token_count']),
    cache_read: pick(['cache_read', 'cache_read_tokens', 'cachedContentTokenCount', 'cached_content_token_count', 'cache_read_input_tokens']),
    cache_write: pick(['cache_write', 'cache_write_tokens', 'cache_creation_input_tokens']),
  };
}

function readNodes(agentsDir) {
  if (!fs.existsSync(agentsDir)) return [];
  const nodes = [];
  const files = fs.readdirSync(agentsDir).filter((x) => x.endsWith('.md')).sort();
  for (const f of files) {
    const abs = path.join(agentsDir, f);
    const content = fs.readFileSync(abs, 'utf8');
    const nameMatch = /^#\s+(.+)$/m.exec(content);
    nodes.push({
      name: f.replace(/\.md$/, ''),
      title: nameMatch ? nameMatch[1].trim() : f.replace(/\.md$/, ''),
      file: path.relative(process.cwd(), abs).replace(/\\/g, '/'),
      model: 'gemini-3.8-flash',
    });
  }
  return nodes;
}

function readMcpConfigs(root) {
  const configs = [
    path.join(root, '.agents', 'mcp_config.json'),
    path.join(root, '.agents', 'plugins', 'forma', 'mcp_config.json'),
  ];
  const project = [];
  for (const p of configs) {
    if (fs.existsSync(p)) {
      const data = readJsonSafe(p);
      project.push({
        file: path.relative(root, p).replace(/\\/g, '/'),
        servers: data && data.mcpServers ? Object.keys(data.mcpServers) : [],
      });
    }
  }
  return { project, user: [], userProject: [] };
}

function engineSettings(root = process.cwd()) {
  const agentsDir = path.join(root, '.agents');
  const present = fs.existsSync(agentsDir);
  const hooksFile = path.join(agentsDir, 'hooks.json');
  const hooksData = readJsonSafe(hooksFile) || {};

  const hooksList = [];
  for (const [hookName, conf] of Object.entries(hooksData)) {
    if (typeof conf !== 'object' || !conf) continue;
    for (const [event, items] of Object.entries(conf)) {
      if (event === 'enabled') continue;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const matcher = item.matcher || '';
        const cmds = [];
        if (Array.isArray(item.hooks)) {
          for (const h of item.hooks) {
            if (h && h.command) cmds.push(String(h.command).replace(/^node\s+hooks\//, '.agents/hooks/'));
          }
        } else if (item.command) {
          cmds.push(String(item.command).replace(/^node\s+hooks\//, '.agents/hooks/'));
        }
        hooksList.push({
          name: hookName,
          event,
          matcher,
          commands: cmds,
        });
      }
    }
  }

  const nodesDir = path.join(agentsDir, 'plugins', 'forma', 'agents');
  const nodes = readNodes(nodesDir);

  const skillsDir = path.join(agentsDir, 'skills');
  const skills = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir).filter((f) => fs.statSync(path.join(skillsDir, f)).isDirectory()).sort()
    : [];

  const mcp = readMcpConfigs(root);

  return {
    present,
    env: {},
    hooks: hooksList,
    nodes,
    skills,
    mcp,
    check: { ran: true, ok: true },
  };
}

function formaRoles(root = process.cwd()) {
  const { readMdCatalog } = getFormaRolesModule();
  const cat = readMdCatalog(root, {
    title: 'Gemini',
    rolesDir: '.agents/plugins/forma/agents',
    mcpFiles: [
      { file: path.join(root, '.agents', 'mcp_config.json'), level: 'проект (.agents/mcp_config.json)' },
      { file: path.join(root, '.agents', 'plugins', 'forma', 'mcp_config.json'), level: 'плагин (.agents/plugins/forma/mcp_config.json)' },
    ],
  });
  cat.plugins = null;
  return cat;
}

module.exports = {
  engine: 'gemini',
  rolesDir: '.agents/plugins/forma/agents',
  onDemandRolesDir: '.agents/plugins/forma/agents/on-demand',
  engineRulesFile: '.agents/rules/gemini-8.md',
  skillsDir: '.agents/skills',

  instructionWeight,
  stepsFromCacheRead,
  transcriptsDir,
  parseUsage,

  usageRefresh: [
    {
      script: '.agents/scripts/sync-ledger.cjs',
      args: ['--dump-cache'],
      cache: 'gemini-usage.json',
    },
  ],

  engineSettings,
  formaRoles,
};
