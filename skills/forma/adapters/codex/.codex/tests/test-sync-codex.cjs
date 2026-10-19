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
// The protocol clone is optional in a project worktree. Its absence skips only
// packaging comparisons; local adapter generation remains fully testable.
const pluginSource = process.env.FORMA_PLUGIN_ROOT ? path.resolve(process.env.FORMA_PLUGIN_ROOT) : path.join(root, '.forma', 'protocol', 'skills', 'forma');
const modern = fs.existsSync(path.join(pluginSource, 'adapters', 'codex'));
const templateRel = modern ? 'adapters/codex' : 'templates-codex';
const templateSource = path.join(pluginSource, templateRel);
const hasPackaged = fs.existsSync(templateSource);
const fixturePlugin = path.join(fixture, 'plugin');
const packaged = 'plugin/' + templateRel;
for (const rel of ['.claude/agents', '.claude/skills', '.codex', '.agents/skills', '.forma/i18n']) copy(rel);
// The generator reads product-profile ownership from this registry, not from names.
const registrySource = path.join(root, 'project/config/PROJECT.md');
if (fs.existsSync(registrySource)) {
  const registryTarget = path.join(fixture, 'project/config/PROJECT.md');
  fs.mkdirSync(path.dirname(registryTarget), { recursive: true });
  fs.copyFileSync(registrySource, registryTarget);
}
// A source worktree may have project-only Run profiles.  Without their
// registry they are not part of a portable fixture, so leave only profiles
// that already have a Codex counterpart.
const fixtureRunProfiles = path.join(fixture, '.claude', 'agents', 'run');
const fixtureRegistry = path.join(fixture, 'project', 'config', 'PROJECT.md');
const fixtureProjectProfiles = fs.existsSync(fixtureRegistry)
  ? /(?:\*\*|^#{1,6}\s*)(?:Профили Run проекта|Project Run profiles)[\s\S]*?(?=^#{1,6}\s|\n\*\*|(?![\s\S]))/m.exec(fs.readFileSync(fixtureRegistry, 'utf8'))?.[0] || ''
  : '';
if (!fixtureProjectProfiles) {
  for (const rel of files(fixtureRunProfiles).filter(file => file.endsWith('.md'))) {
    const name = rel.slice(0, -3);
    const role = path.join(fixture, '.codex', 'roles', 'run', rel);
    const agent = path.join(fixture, '.codex', 'agents', name + '.toml');
    if (!fs.existsSync(role) && !fs.existsSync(agent)) fs.rmSync(path.join(fixtureRunProfiles, rel));
  }
}
if (hasPackaged) copyTree(templateSource, path.join(fixturePlugin, templateRel));
const command = path.join(fixture, '.codex', 'scripts', 'sync-codex.cjs');
const claudeTemplate = hasPackaged ? path.join(pluginSource, modern ? 'adapters/claude' : 'template') : null;
const templateEngineSync = claudeTemplate && path.join(claudeTemplate, 'scripts', modern ? 'checks/codex.cjs' : 'sync-engines.cjs');
function check(expectSuccess, name) {
  const result = cp.spawnSync(process.execPath, [command, '--check', '--codex-only', '--root', fixture, '--plugin', fixturePlugin], { encoding: 'utf8' });
  if ((result.status === 0) !== expectSuccess) throw new Error(`${name}: ${result.stdout}${result.stderr}`);
  return result;
}
try {
  const usageFixtures = cp.spawnSync(process.execPath, [path.join(root, '.codex/tests/test-codex-usage.cjs')], { encoding: 'utf8' });
  if (usageFixtures.status !== 0) throw new Error(`continuation usage fixtures: ${usageFixtures.stdout}${usageFixtures.stderr}`);
  if (templateEngineSync && fs.existsSync(templateEngineSync)) {
    const templateSyncText = fs.readFileSync(templateEngineSync, 'utf8');
    if (!templateSyncText.includes("adapter.includes(`${CLAUDE_ON_DEMAND_DIR}/${f}`)")) {
      throw new Error('template engine sync must validate the canonical on-demand link, not compare adapter text');
    }
    if (templateSyncText.includes("normalizeText(fs.readFileSync(path.join(claudeOnDemand, f), 'utf8'), 'on-demand')")) {
      throw new Error('template engine sync still compares Codex on-demand adapters with Claude procedure bodies');
    }
  }
  // External mirrors and packaging remain observable, but cannot fail a local
  // Codex fixture merely because another owner's baseline is not synchronized.
  const externalDrift = cp.spawnSync(process.execPath, [command, '--check', '--root', fixture, '--plugin', fixturePlugin], { encoding: 'utf8' });
  if (externalDrift.status !== 0) {
    const externalDriftLines = (externalDrift.stdout + externalDrift.stderr)
      .split(/\r?\n/)
      .filter(line => line.startsWith('- '));
    if (externalDrift.status !== 1 || !externalDriftLines.length || externalDriftLines.some(line => !/^- (?:template |skill mirror)/.test(line))) {
      throw new Error(`unexpected local drift in full check: ${externalDrift.stdout}${externalDrift.stderr}`);
    }
    console.log('External baseline (outside Codex-only fixture):\n' + externalDriftLines.join('\n'));
  }
  const fullCheck = () => cp.spawnSync(process.execPath, [command, '--check', '--root', fixture, '--plugin', fixturePlugin], { encoding: 'utf8' });
  const baseline = fullCheck();
  let baselineProblems = new Set((baseline.stdout + baseline.stderr).split(/\r?\n/).filter(line => line.startsWith('- ')));
  check(true, 'clean Codex fixture');
  // Native portable counterparts survive a same-name product registration;
  // removing native ownership must still reject the product import.
  const registry = path.join(fixture, 'project/config/PROJECT.md');
  const registryBefore = fs.existsSync(registry) ? fs.readFileSync(registry, 'utf8') : null;
  const nativeRole = path.join(fixture, '.codex/roles/run/run-portable-fixture.md');
  const nativeAgent = path.join(fixture, '.codex/agents/run-portable-fixture.toml');
  const nativeBody = '---\nname: run-portable-fixture\norigin: codex\n---\n\n## Takes / does not take\n\nLocal fixture transformation only.\n\n## Boundary\n\nNo live writes.\n';
  fs.mkdirSync(path.dirname(registry), { recursive: true });
  const fixtureProfile = '| `run-portable-fixture` | fixture product role |\n';
  fs.writeFileSync(registry, registryBefore === null
    ? `**Project Run profiles**\n\n${fixtureProfile}`
    : `${registryBefore}${registryBefore.endsWith('\n') ? '' : '\n'}${fixtureProfile}`);
  fs.writeFileSync(nativeRole, nativeBody);
  fs.writeFileSync(nativeAgent, 'name = "run-portable-fixture"\nmodel = "gpt-5.6-luna"\nmodel_reasoning_effort = "low"\n');
  check(true, 'native counterpart of product profile');
  fs.writeFileSync(nativeRole, nativeBody.replace('origin: codex\n', ''));
  check(false, 'product import without native ownership');
  fs.writeFileSync(nativeRole, nativeBody);
  const nativeApply = cp.spawnSync(process.execPath, [command, '--apply', '--codex-only', '--root', fixture], { encoding: 'utf8' });
  if (nativeApply.status !== 0 || fs.readFileSync(nativeRole, 'utf8') !== nativeBody) throw new Error('Synchronization replaced native portable counterpart');
  fs.rmSync(nativeRole);
  fs.rmSync(nativeAgent);
  if (registryBefore === null) fs.rmSync(registry); else fs.writeFileSync(registry, registryBefore);
  check(true, 'restored native counterpart fixture');
  const sharedSkill = path.join(fixture, '.agents', 'skills', 'graph-build', 'SKILL.md');
  const sharedSkillBefore = fs.readFileSync(sharedSkill, 'utf8');
  // Give the mutation check one clean shared skill: project-level Gemini
  // drift is allowed to exist, but must not hide a fixture regression.
  copyTree(path.join(fixture, '.claude', 'skills', 'grilling'), path.join(fixture, '.agents', 'skills', 'grilling'));
  const manifest = path.join(fixture, '.codex', 'generated-skill-mirror.json');
  fs.writeFileSync(manifest, '{"skills":[]}\n');
  const codexOnly = cp.spawnSync(process.execPath, [command, '--apply', '--codex-only', '--root', fixture, '--plugin', fixturePlugin], { encoding: 'utf8' });
  if (codexOnly.status !== 0 || fs.readFileSync(sharedSkill, 'utf8') !== sharedSkillBefore || !fs.readFileSync(manifest, 'utf8').includes('graph-build')) {
    throw new Error(`Codex-only apply must refresh its manifest without writing .agents/skills: ${codexOnly.stdout}${codexOnly.stderr}`);
  }
  const fixtureBaseline = fullCheck();
  baselineProblems = new Set((fixtureBaseline.stdout + fixtureBaseline.stderr).split(/\r?\n/).filter(line => line.startsWith('- ')));
  const profile = path.join(fixture, '.codex', 'roles', 'run', 'run-site-php.md');
  const canonicalProfile = fs.readFileSync(path.join(fixture, '.claude', 'agents', 'run', 'run-site-php.md'), 'utf8')
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
  if (fs.readFileSync(profile, 'utf8').includes(canonicalProfile)) throw new Error('Run profile copied the canonical body instead of linking it');
  const cases = [
    ['model tier', path.join(fixture, '.codex/agents/intent.toml'), s => s.replace('model_reasoning_effort = "medium"', 'model_reasoning_effort = "low"')],
    ['role link', path.join(fixture, '.codex/roles/kit.md'), s => s.replace('.claude/agents/kit.md', '.claude/agents/not-kit.md')],
    ['skill mirror', path.join(fixture, '.agents/skills/grilling/SKILL.md'), s => `${s}\nfixture drift\n`],
    ['hook declaration', path.join(fixture, '.codex/hooks.json'), s => s.replace('tool-usage.ps1', 'tool-usage-removed.ps1')],
    ['canonical Run profile set', path.join(fixture, '.claude/agents/run/run-mechanical.md'), s => s]
  ];
  if (hasPackaged) cases.push(['template file', path.join(fixture, packaged, '.codex/hooks.json'), s => `${s}\nfixture drift\n`]);
  for (const [name, file, mutate] of cases) {
    const original = fs.readFileSync(file, 'utf8');
    if (name === 'canonical Run profile set') { fs.rmSync(file); check(false, name); fs.writeFileSync(file, original); }
    else {
      fs.writeFileSync(file, mutate(original));
      if (name === 'skill mirror' || name === 'template file') {
        const result = fullCheck();
        const newProblems = (result.stdout + result.stderr).split(/\r?\n/).filter(line => line.startsWith('- ') && !baselineProblems.has(line));
        const expected = name === 'skill mirror' ? '- skill mirror grilling: content differs at SKILL.md' : '- template .codex: content differs at hooks.json';
        if (result.status !== 1 || !newProblems.includes(expected)) throw new Error(`${name}: expected additional drift ${expected}: ${result.stdout}${result.stderr}`);
      } else check(false, name);
      fs.writeFileSync(file, original);
    }
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
      if (result.error || result.status == null) throw new Error(`installed template could not run: ${result.error}`);
      if (result.status !== 0) console.log(`External installed template (${templateSource}): ${result.stdout}${result.stderr}`);
    } finally {
      if (path.dirname(path.resolve(installed)) !== path.resolve(os.tmpdir()) || !path.basename(installed).startsWith('forma-codex-installed-')) throw new Error('Unsafe installed fixture cleanup target');
      fs.rmSync(installed, { recursive: true, force: true });
    }
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
  console.log('Codex sync fixtures verified: clean source, plus model, role, skill, and hook drift' + (hasPackaged ? ', installed template, and template drift.' : '; protocol-clone packaging checks skipped.'));
} finally {
  if (path.dirname(path.resolve(fixture)) !== path.resolve(os.tmpdir()) || !path.basename(fixture).startsWith('forma-codex-sync-')) throw new Error('Unsafe fixture cleanup target');
  fs.rmSync(fixture, { recursive: true, force: true });
}
