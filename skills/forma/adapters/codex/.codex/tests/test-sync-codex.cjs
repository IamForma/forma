#!/usr/bin/env node
'use strict';

// Pure filesystem fixtures: no Codex Desktop, MCP server, or host hook is required.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const fixtureDate = new Date(0).toISOString().slice(0, 10);
const atSecond = seconds => new Date(seconds * 1000).toISOString();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-codex-sync-'));
function files(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(prefix, entry.name);
    return entry.isDirectory() ? files(path.join(dir, entry.name), rel) : entry.isFile() ? [rel] : [];
  });
}
function copy(rel) {
  copyTree(path.join(root, rel), path.join(fixture, rel));
}
function copyTree(source, target) {
  for (const file of files(source)) {
    const out = path.join(target, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(path.join(source, file), out);
  }
}
// The plugin: .forma/protocol/ inside the project; its absence is a failure here, never a silent skip.
const pluginSource = process.env.FORMA_PLUGIN_ROOT ? path.resolve(process.env.FORMA_PLUGIN_ROOT) : path.join(root, '.forma', 'protocol', 'skills', 'forma');
const modern = fs.existsSync(path.join(pluginSource, 'adapters', 'codex'));
const templateRel = modern ? 'adapters/codex' : 'templates-codex';
const templateSource = path.join(pluginSource, templateRel);
if (!fs.existsSync(templateSource)) throw new Error('Forma plugin template not found: ' + templateSource + ' (set FORMA_PLUGIN_ROOT)');
const hasPackaged = true;
const fixturePlugin = path.join(fixture, 'plugin');
const packaged = 'plugin/' + templateRel;
for (const rel of ['.claude/agents', '.claude/skills', '.codex', '.agents/skills']) copy(rel);
copyTree(templateSource, path.join(fixturePlugin, templateRel));
const command = path.join(fixture, '.codex', 'scripts', 'sync-codex.cjs');
const claudeTemplate = path.join(pluginSource, modern ? 'adapters/claude' : 'template');
const templateEngineSync = path.join(claudeTemplate, 'scripts', modern ? 'checks/codex.cjs' : 'sync-engines.cjs');
function check(expectSuccess, name) {
  const result = cp.spawnSync(process.execPath, [command, '--check', '--root', fixture, '--plugin', fixturePlugin], { encoding: 'utf8' });
  if ((result.status === 0) !== expectSuccess) throw new Error(`${name}: ${result.stdout}${result.stderr}`);
  return result;
}
try {
  const usageFixtures = cp.spawnSync(process.execPath, [path.join(root, '.codex/tests/test-codex-usage.cjs')], { encoding: 'utf8' });
  if (usageFixtures.status !== 0) throw new Error(`continuation usage fixtures: ${usageFixtures.stdout}${usageFixtures.stderr}`);
  if (fs.existsSync(templateEngineSync)) {
    const templateSyncText = fs.readFileSync(templateEngineSync, 'utf8');
    if (!templateSyncText.includes("adapter.includes(`${CLAUDE_ON_DEMAND_DIR}/${f}`)")) {
      throw new Error('template engine sync must validate the canonical on-demand link, not compare adapter text');
    }
    if (templateSyncText.includes("normalizeText(fs.readFileSync(path.join(claudeOnDemand, f), 'utf8'), 'on-demand')")) {
      throw new Error('template engine sync still compares Codex on-demand adapters with Claude procedure bodies');
    }
  }
  // `.agents/skills/` is a shared external mirror.  Capture its live drift
  // first, then make this Codex fixture self-contained from the canonical
  // Claude skill before exercising its own synchronization contract.
  const externalDrift = cp.spawnSync(process.execPath, [command, '--check', '--root', fixture, '--plugin', fixturePlugin], { encoding: 'utf8' });
  if (externalDrift.status !== 0) {
    const externalDriftLines = (externalDrift.stdout + externalDrift.stderr)
      .split(/\r?\n/)
      .filter(line => line.startsWith('- '));
    const expectedExternalDrift = '- skill mirror graph-build: content differs at SKILL.md';
    if (externalDrift.status !== 1 || externalDriftLines.length !== 1 || externalDriftLines[0] !== expectedExternalDrift) {
      throw new Error(`external graph-build drift must be exactly ${expectedExternalDrift}: ${externalDrift.stdout}${externalDrift.stderr}`);
    }
    console.log('External dependency: .agents/skills/graph-build/SKILL.md — content differs from .claude/skills/graph-build/SKILL.md.');
    copyTree(path.join(fixture, '.claude', 'skills', 'graph-build'), path.join(fixture, '.agents', 'skills', 'graph-build'));
  }
  check(true, 'clean Codex fixture');
  const cases = [
    ['model tier', path.join(fixture, '.codex/agents/intent.toml'), s => s.replace('model_reasoning_effort = "low"', 'model_reasoning_effort = "medium"')],
    ['role link', path.join(fixture, '.codex/roles/kit.md'), s => s.replace('.claude/agents/kit.md', '.claude/agents/not-kit.md')],
    ['skill mirror', path.join(fixture, '.agents/skills/grilling/SKILL.md'), s => `${s}\nfixture drift\n`],
    ['hook declaration', path.join(fixture, '.codex/hooks.json'), s => s.replace('tool-usage.ps1', 'tool-usage-removed.ps1')],
    ['canonical Run profile set', path.join(fixture, '.claude/agents/run/run-mechanical.md'), s => s]
  ];
  if (hasPackaged) cases.push(['template file', path.join(fixture, packaged, '.codex/hooks.json'), s => `${s}\nfixture drift\n`]);
  for (const [name, file, mutate] of cases) {
    const original = fs.readFileSync(file, 'utf8');
    if (name === 'canonical Run profile set') { fs.rmSync(file); check(false, name); fs.writeFileSync(file, original); }
    else { fs.writeFileSync(file, mutate(original)); check(false, name); fs.writeFileSync(file, original); }
  }
  if (hasPackaged) {
    const installed = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-codex-installed-'));
    try {
      // An installed project gets the plugin's own generic Claude side, not this project's.
      copyTree(path.join(claudeTemplate, 'agents'), path.join(installed, '.claude/agents'));
      copyTree(path.join(claudeTemplate, 'skills'), path.join(installed, '.claude/skills'));
      if (modern) copyTree(path.join(pluginSource, 'core', 'skills'), path.join(installed, '.claude/skills'));
      const packagedRoot = templateSource;
      copyTree(path.join(packagedRoot, '.codex'), path.join(installed, '.codex'));
      copyTree(path.join(packagedRoot, '.agents'), path.join(installed, '.agents'));
      const installedCommand = path.join(installed, '.codex/scripts/sync-codex.cjs');
      const result = cp.spawnSync(process.execPath, [installedCommand, '--check', '--root', installed], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`clean installed template: ${result.stdout}${result.stderr}`);
    } finally { fs.rmSync(installed, { recursive: true, force: true }); }
  }
  // The final snapshot is cumulative.  Re-running attachment to the same card
  // must not add it again, and the session metadata must preserve the child role.
  const usageFixture = path.join(fixture, 'usage.jsonl');
  const usageCard = path.join(fixture, 'card.md');
  fs.writeFileSync(usageFixture, [
    JSON.stringify({ timestamp: atSecond(0), type: 'session_meta', payload: { id: 'usage-child-1', cwd: fixture, source: { subagent: { thread_spawn: { agent_role: 'kit' } } } } }),
    JSON.stringify({ timestamp: atSecond(3), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 100, cached_input_tokens: 20 } } } }),
    JSON.stringify({ timestamp: atSecond(8), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 250, cached_input_tokens: 90 } } } }),
  ].join('\n') + '\n');
  fs.writeFileSync(usageCard, '# card\n\n## History\n\n## Result\n');
  const usage = path.join(fixture, '.codex', 'scripts', 'codex-usage.cjs');
  for (let i = 0; i < 2; i += 1) {
    const result = cp.spawnSync(process.execPath, [usage, '--file', usageFixture, '--complete', '--card', usageCard], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`usage fixture: ${result.stdout}${result.stderr}`);
  }
  const history = fs.readFileSync(usageCard, 'utf8');
  if ((history.match(/`usage-child-1`/g) || []).length !== 1 || !history.includes('`Kit`, ' + fixtureDate + ': attempt, 250 tokens (90 cache-read), 8 s, `usage-child-1` — codex:')) {
    throw new Error('usage fixture did not use the final total or deduplicate the card attachment');
  }
  const mainFixture = path.join(fixture, 'usage-main.jsonl');
  const foreignFixture = path.join(fixture, 'usage-foreign.jsonl');
  const unknownDuration = path.join(fixture, 'usage-unknown-duration.jsonl');
  fs.writeFileSync(mainFixture, JSON.stringify({ type: 'session_meta', payload: { id: 'usage-main', cwd: fixture } }) + '\n' + JSON.stringify({ timestamp: atSecond(8), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 1, cached_input_tokens: 0 } } } }) + '\n');
  fs.writeFileSync(foreignFixture, JSON.stringify({ timestamp: atSecond(0), type: 'session_meta', payload: { id: 'usage-foreign', cwd: 'C:\\other', source: { subagent: { thread_spawn: { agent_role: 'kit' } } } } }) + '\n' + JSON.stringify({ timestamp: atSecond(8), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 1, cached_input_tokens: 0 } } } }) + '\n');
  fs.writeFileSync(unknownDuration, JSON.stringify({ payload: { id: 'usage-unknown-duration', cwd: fixture, source: { subagent: { thread_spawn: { agent_role: 'kit' } } } }, type: 'session_meta' }) + '\n' + JSON.stringify({ timestamp: atSecond(8), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 2, cached_input_tokens: 1 } } } }) + '\n');
  for (const file of [mainFixture, foreignFixture]) {
    const result = cp.spawnSync(process.execPath, [usage, '--file', file, '--complete', '--card', usageCard], { encoding: 'utf8' });
    if (result.status === 0) throw new Error('usage fixture allowed an ineligible card attachment');
  }
  const unknownResult = cp.spawnSync(process.execPath, [usage, '--file', unknownDuration], { encoding: 'utf8' });
  if (unknownResult.status !== 0 || !unknownResult.stdout.includes('unknown s')) throw new Error('usage fixture did not preserve an unknown duration marker');
  console.log('Codex sync fixtures verified: clean source, plus model, role, skill, and hook drift' + (hasPackaged ? ', installed template, and template drift.' : '.'));
} finally { fs.rmSync(fixture, { recursive: true, force: true }); }
