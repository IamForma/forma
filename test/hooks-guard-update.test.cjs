'use strict';
// guard-delete.sh and check-plugin-update.sh: run as Claude Code runs them (JSON on stdin, project dir in env).
// Each guard case runs twice: with jq on PATH and without it (Git Bash on Windows ships without jq).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOKS = path.join(__dirname, '..', 'skills', 'forma', 'adapters', 'claude', 'hooks');
const TOOLS = ['sh', 'bash', 'cat', 'grep', 'awk', 'tr', 'find', 'head', 'tail', 'sed', 'printf', 'node', 'rm', 'sort', 'ls', 'date'];

function which(bin) {
  const r = spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** A PATH directory holding only the given tools (symlinks), so a missing jq/gh/curl is real. */
function toolDir(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-bin-'));
  for (const t of TOOLS) { const p = which(t); if (p) fs.symlinkSync(p, path.join(dir, t)); }
  for (const [name, body] of Object.entries(extra)) fs.writeFileSync(path.join(dir, name), body, { mode: 0o755 });
  return dir;
}

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-hook-'));
  for (const d of ['.claude/hooks', '.devtool/features', '.forma/manual', '.forma/board', 'build', 'project/goals/goal-a']) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '');
  fs.writeFileSync(path.join(root, 'project/goals/goal-a/GOAL.md'), '');
  return root;
}

function run(hook, root, input, envPath) {
  return spawnSync('bash', [path.join(HOOKS, hook)], {
    input: JSON.stringify(input), encoding: 'utf8',
    env: { PATH: envPath, HOME: root, CLAUDE_PROJECT_DIR: root },
  });
}

const BLOCK = [
  'rm -rf .claude', 'rm -rf .claude/', 'rm -rf .devtool', 'rm -rf .forma', 'rm -rf .forma/manual', 'rm AGENTS.md',
  'git clean -fdx', 'git clean -fd', 'find . -delete', 'find .claude -delete', 'rm -rf .', 'rm -rf *',
  `node -e "require('fs').rmSync('.claude',{recursive:true})"`, `python3 -c "import shutil; shutil.rmtree('.devtool')"`,
  `perl -e 'unlink("AGENTS.md")'`, 'mv .claude /tmp/x', 'mv -f AGENTS.md ../x', 'cd build && mv ../.forma/manual /tmp',
  'Move-Item .devtool C:\\tmp', 'mv .claude .claude.bak', 'mv -t /tmp .claude', 'mv --target-directory=/tmp AGENTS.md', 'mv -t /tmp/x .forma/manual a.txt',
];
const PASS = [
  'rm -rf node_modules', 'rm -f build/out.js', 'git clean -fd build/', "git commit -m 'clean up'", 'npm run clean',
  'echo rm -rf .claude', 'rm -rf .forma/board/tmp', 'ls .claude', 'find build -delete', 'rm -rf .claude-plugin',
  `node -e "console.log(1)"`, 'node scripts/build.js', 'mv build/a.js build/b.js', 'mv notes.txt .forma/board/notes.txt', 'echo mv .claude /tmp',
  'mv -t .forma/board/x notes.txt', 'mv -t build a.js b.js',
];

const withJq = which('jq') ? process.env.PATH : null;
const noJq = toolDir();
const modes = [['without jq', noJq], ...(withJq ? [['with jq', withJq]] : [])];

for (const [mode, envPath] of modes) {
  test(`guard-delete ${mode}: deleting a protected path is blocked`, () => {
    const root = project();
    for (const command of BLOCK) {
      const r = run('guard-delete.sh', root, { tool_input: { command } }, envPath);
      assert.equal(r.status, 2, `${command} must be blocked: ${r.stderr}`);
    }
  });

  test(`guard-delete ${mode}: ordinary commands pass`, () => {
    const root = project();
    for (const command of PASS) {
      const r = run('guard-delete.sh', root, { tool_input: { command } }, envPath);
      assert.equal(r.status, 0, `${command} must pass: ${r.stderr}`);
    }
  });

  test(`unlock-delete ${mode}: the code phrase lets exactly one deletion through`, () => {
    const root = project();
    const del = { tool_input: { command: 'rm -rf .claude' } };
    run('unlock-delete.sh', root, { prompt: 'Подключи сенсорику' }, envPath);
    assert.equal(run('guard-delete.sh', root, del, envPath).status, 2, '"Подключи" does not unlock');
    run('unlock-delete.sh', root, { prompt: 'ок, отключи сенсорику' }, envPath);
    assert.equal(run('guard-delete.sh', root, del, envPath).status, 0, 'first deletion after the phrase passes');
    assert.equal(run('guard-delete.sh', root, del, envPath).status, 2, 'the permission does not linger');
  });
}

function updateCase({ installed, cache, remote }) {
  const root = project();
  if (installed) fs.writeFileSync(path.join(root, '.forma/install-manifest.json'), JSON.stringify({ manifestVersion: 1, version: installed }));
  if (cache) fs.mkdirSync(path.join(root, '.claude/plugins/cache/forma/forma', cache), { recursive: true });
  const curl = remote ? `#!/bin/sh\necho '{"name": "forma", "version": "${remote}"}'\n` : null;
  const bin = toolDir(curl ? { curl } : {});
  const r = run('check-plugin-update.sh', root, {}, bin);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
  return r.stdout;
}

test('check-plugin-update: versions with a suffix are compared by their numbers', () => {
  assert.match(updateCase({ installed: '0.4.185-alpha', remote: '0.4.186-alpha' }), /0\.4\.185-alpha.*0\.4\.186-alpha/);
  assert.match(updateCase({ installed: '0.4.185-alpha', remote: '0.4.1000' }), /0\.4\.1000/);
  assert.equal(updateCase({ installed: '0.4.186-alpha', remote: '0.4.186-alpha' }), '');
  assert.equal(updateCase({ installed: '0.4.186-alpha', remote: '0.4.185-alpha' }), '', 'local ahead is not an update');
});

test('check-plugin-update: plugin cache is read when there is no install manifest', () => {
  assert.match(updateCase({ cache: '0.4.186-alpha', remote: '0.5.0' }), /0\.4\.186-alpha.*0\.5\.0/);
  assert.equal(updateCase({ remote: '0.5.0' }), '', 'nothing installed: silent');
});

test('check-plugin-update: no gh and no curl means silence, not an error', () => {
  assert.equal(updateCase({ installed: '0.4.185-alpha' }), '');
});

// Codex runs its hooks with PowerShell; the same update logic, checked where pwsh is installed (GitHub runners have it).
const pwsh = which('pwsh');
test('check-plugin-update.ps1 (Codex): compares by numbers, says how to update, stays silent otherwise', { skip: !pwsh && 'no pwsh' }, () => {
  const hook = path.join(__dirname, '..', 'skills', 'forma', 'adapters', 'codex', '.codex', 'hooks', 'check-plugin-update.ps1');
  const gh = (v) => `#!/bin/sh\necho '{"name": "forma", "version": "${v}"}'\n`;
  const runPs = (installed, remote) => {
    const root = project();
    fs.mkdirSync(path.join(root, '.codex', 'hooks'), { recursive: true });
    fs.copyFileSync(hook, path.join(root, '.codex', 'hooks', 'check-plugin-update.ps1'));
    if (installed) fs.writeFileSync(path.join(root, '.forma/install-manifest.json'), JSON.stringify({ version: installed }));
    const bin = toolDir({ gh: gh(remote) });
    fs.symlinkSync(pwsh, path.join(bin, 'pwsh'));
    const r = spawnSync(pwsh, ['-NoProfile', '-File', '.codex/hooks/check-plugin-update.ps1'], { cwd: root, encoding: 'utf8', env: { PATH: bin, HOME: root } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  assert.match(runPs('0.4.185-alpha', '0.4.187-alpha'), /0\.4\.185-alpha.*0\.4\.187-alpha.*npx github:IamForma\/forma init/s);
  assert.match(runPs('0.4.185-alpha', '0.4.1000'), /0\.4\.1000/);
  assert.equal(runPs('0.4.187-alpha', '0.4.187-alpha'), '');
  assert.equal(runPs('0.5.0', '0.4.187-alpha'), '', 'local ahead is not an update');
  assert.equal(runPs(null, '0.5.0'), '', 'no install manifest: silent');
});

// Codex guard-delete.ps1 is regex-based and runs where pwsh may be absent: its two patterns are lifted out of the
// script and checked here as JS regexes (the syntax used is common to .NET and JS). Same cases as Claude's guard.
test('guard-delete.ps1 (Codex): the verbs and protected paths of the Claude guard are covered', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'skills', 'forma', 'adapters', 'codex', '.codex', 'hooks', 'guard-delete.ps1'), 'utf8');
  const pat = (name) => {
    const m = src.match(new RegExp('\\$' + name + " = \\$command -match '\\(\\?i\\)(.*)'$", 'm'));
    assert.ok(m, `no pattern for $${name}`);
    return new RegExp(m[1], 'i');
  };
  const destructive = pat('destructive'), protectedRe = pat('protected');
  const blocked = (c) => destructive.test(c) && protectedRe.test(c);
  for (const c of [...BLOCK.filter((x) => !/^(rm -rf \*|rm -rf \.|find \. -delete|git clean)/.test(x))]) {
    assert.ok(blocked(c), `must block: ${c}`);
  }
  for (const c of ['rm -rf node_modules', 'ls .claude', 'node scripts/build.js', 'mv build/a.js build/b.js', 'git commit -m "move the card"']) {
    assert.ok(!blocked(c), `must pass: ${c}`);
  }
});
