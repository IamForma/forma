'use strict';

// Install verify profile for Claude Code: adapter wiring (hooks, roles, references) and start-up check behavior.
// The core (`.forma/verify/verify-install.cjs`) finds this file via the manifest (`engines[].profile`) and calls `check(ctx)`.
// Expectations come from the manifest (`engine.expect`), not from code: the installer recorded what it installed — the profile checks that against disk.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const walkFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walkFiles(p) : [p];
  });
};

/**
 * A working bash, or null. On Windows `bash` on PATH is often the WSL launcher (no distro, or a localhost-proxy warning),
 * not a shell: Git Bash is tried first, and every candidate must actually run a command. Claude Code runs the hooks with
 * its own bash, so with none usable here the shell-based checks are skipped rather than reported as a broken install.
 */
function findBash() {
  const candidates = [];
  if (process.platform === 'win32') {
    const git = spawnSync('where', ['git'], { encoding: 'utf8' });
    for (const g of (git.stdout || '').split(/\r?\n/).filter(Boolean)) candidates.push(path.join(path.dirname(g), '..', 'bin', 'bash.exe'));
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')]) {
      if (base) candidates.push(path.join(base, 'Git', 'bin', 'bash.exe'));
    }
  }
  candidates.push('bash');
  for (const c of candidates) {
    if (c !== 'bash' && !fs.existsSync(c)) continue;
    const r = spawnSync(c, ['-c', 'echo forma'], { encoding: 'utf8' });
    if (!r.error && r.status === 0 && (r.stdout || '').trim() === 'forma') return c;
  }
  return null;
}

/** Hook wiring: for every expected hook the file exists and settings.json has its command in the event group. */
function checkHooks(ctx, expect, out) {
  const { root, finding } = ctx;
  const settingsFile = path.join(root, '.claude', 'settings.json');
  if (!fs.existsSync(settingsFile)) { out.push(finding('.claude/settings.json', 'Claude Code settings with hooks', 'file missing')); return; }
  let settings;
  try { settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); }
  catch (e) { out.push(finding('.claude/settings.json', 'valid JSON', e.message)); return; }
  for (const h of expect.hooks || []) {
    const file = `.claude/hooks/${h.name}`;
    if (!fs.existsSync(path.join(root, file))) out.push(finding(file, `hook ${h.event}${h.matcher ? ' [' + h.matcher + ']' : ''}`, 'file missing'));
    const groups = (settings.hooks && settings.hooks[h.event]) || [];
    const group = groups.find((g) => (g.matcher || '') === (h.matcher || ''));
    const entry = group && (group.hooks || []).find((x) => x.command === `bash ${file}`);
    const addr = `.claude/settings.json → hooks.${h.event}${h.matcher ? '[' + h.matcher + ']' : ''}`;
    if (!entry) out.push(finding(addr, `command «bash ${file}»`, group ? 'command not in the group' : 'event group missing'));
    else if (h.timeout && entry.timeout !== h.timeout) out.push(finding(addr + ' → ' + h.name + ' → timeout', String(h.timeout), String(entry.timeout)));
  }
  const bash = findBash();
  if (!bash) return;
  for (const f of walkFiles(path.join(root, '.claude', 'hooks')).filter((x) => x.endsWith('.sh'))) {
    const r = spawnSync(bash, ['-n', f], { encoding: 'utf8' });
    if (r.error) { out.push(finding('bash', 'bash available to check hooks', r.error.message)); break; }
    if (r.status !== 0) out.push(finding(path.relative(root, f).split(path.sep).join('/'), 'bash -n: hook syntax', (r.stderr || '').trim().split('\n')[0]));
  }
}

/** Roles: the five nodes are present, `tools:` has no `mcp__<…>__*` placeholders, no root CLAUDE.md. */
function checkRoles(ctx, out) {
  const { root, finding } = ctx;
  const dir = path.join(root, '.claude', 'agents');
  for (const a of ['intent', 'spec', 'kit', 'core']) {
    if (!fs.existsSync(path.join(dir, a + '.md'))) out.push(finding(`.claude/agents/${a}.md`, 'node role', 'file missing'));
  }
  if (!fs.existsSync(dir) || !fs.readdirSync(dir).some((f) => /^run.*\.md$/.test(f))) out.push(finding('.claude/agents/run*.md', 'at least one executor', 'none'));
  for (const f of walkFiles(dir).filter((x) => x.endsWith('.md'))) {
    const fm = fs.readFileSync(f, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const tools = fm && (fm[1].match(/^tools:.*$/m) || [''])[0];
    if (tools && /mcp__<[^>]*>/.test(tools)) out.push(finding(path.relative(root, f).split(path.sep).join('/') + ' — tools:', 'tool names without placeholders', tools.match(/mcp__<[^>]*>[^,\s]*/)[0]));
  }
  if (fs.existsSync(path.join(root, 'CLAUDE.md'))) out.push(finding('CLAUDE.md', 'no root CLAUDE.md (it shadows reading AGENTS.md)', 'file present'));
}

/** Reference closure: a bare `name.md` in the law and §8 (lowercase, no path) names a file that exists in `.claude/` or `.forma/`. */
function checkReferences(ctx, out) {
  const { root, finding } = ctx;
  const known = new Set();
  for (const d of ['.claude', '.forma']) for (const f of walkFiles(path.join(root, d))) known.add(path.basename(f));
  for (const src of ['AGENTS.md', '.claude/rules/claude-8.md']) {
    const f = path.join(root, src);
    if (!fs.existsSync(f)) { if (src !== 'AGENTS.md') out.push(finding(src, '§8 Claude Code', 'file missing')); continue; }
    const seen = new Set();
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/`([a-z][a-z0-9-]*\.md)`/g)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      if (!known.has(m[1])) out.push(finding(`${src} → \`${m[1]}\``, 'file in .claude/ or .forma/', 'no such file'));
    }
  }
}

/** Behavior: the start hook and the core-vs-adapter check run and respond; no model is called. */
function checkBehavior(ctx, out) {
  const { root, finding } = ctx;
  const hook = path.join(root, '.claude', 'hooks', 'check-ready.sh');
  const bash = findBash();
  if (bash && fs.existsSync(hook)) {
    const r = spawnSync(bash, [hook], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root, FORMA_LANG: 'en' } });
    if (r.error || r.status !== 0) out.push(finding('.claude/hooks/check-ready.sh', 'exit 0', r.error ? r.error.message : 'exit ' + r.status));
    else for (const l of (r.stdout || '').split('\n').filter((x) => /^\s+· (agents|environment parity)/.test(x))) out.push(finding('.claude/hooks/check-ready.sh', 'no role or parity remarks', l.trim()));
  }
  const sync = path.join(root, '.claude', 'scripts', 'sync-engines.cjs');
  if (fs.existsSync(sync)) {
    const r = spawnSync(process.execPath, [sync, '--check'], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) {
      const why = ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('— ')).slice(0, 5);
      out.push(finding('node .claude/scripts/sync-engines.cjs --check', 'exit 0', 'exit ' + r.status + (why.length ? ': ' + why.join(' | ') : '')));
    }
  }
}

function check(ctx) {
  const out = [];
  const expect = ctx.engine.expect || {};
  checkHooks(ctx, expect, out);
  checkRoles(ctx, out);
  checkReferences(ctx, out);
  if (ctx.behavior) checkBehavior(ctx, out);
  return out;
}

module.exports = { id: 'claude', check };
