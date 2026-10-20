// Gemini (бета) ставится установщиком; Codex спит (core/engines.json) — не ставится, явный запрос отклоняется.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const FORMA = path.resolve(__dirname, '..', 'bin', 'forma.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-engines-'));
const init = (engines) => spawnSync(process.execPath, [FORMA, 'init', '--dir', dir, '--engines', engines, '--board', 'skip', '--yes'], { encoding: 'utf8' });

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('claude,gemini: адаптер Gemini установлен, Codex не ставится, сверка целостна', () => {
  const r = init('claude,gemini');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const f of [
    '.forma/engines.json',
    '.agents/rules/gemini-8.md', '.agents/forma-adapter.cjs', '.agents/plugins/forma/plugin.json', '.agents/plugins/forma/agents/kit.md', '.agents/plugins/forma/mcp_config.json',
  ]) assert.ok(fs.existsSync(path.join(dir, f)), f);
  assert.ok(!fs.existsSync(path.join(dir, '.codex')), 'Codex спит — .codex/ не ставится');
  assert.match(r.stdout, /Gemini \(Antigravity, beta\)/);
  assert.doesNotMatch(r.stdout, /Codex/);
  assert.match(r.stdout, /install is intact/);
});

test('повторный запуск не затирает mcp_config.json проекта', () => {
  const mcp = path.join(dir, '.agents', 'plugins', 'forma', 'mcp_config.json');
  fs.writeFileSync(mcp, '{"mcpServers":{"site":{}}}');
  const r = init('claude,gemini');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(fs.readFileSync(mcp, 'utf8'), /"site"/);
});

test('--engines codex: спящий движок отклоняется кодом 2, ничего не ставится', () => {
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-engines2-'));
  try {
    const r = spawnSync(process.execPath, [FORMA, 'init', '--dir', d2, '--engines', 'codex', '--board', 'skip', '--yes'], { encoding: 'utf8' });
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /dormant/);
    assert.ok(!fs.existsSync(path.join(d2, '.codex')));
  } finally { fs.rmSync(d2, { recursive: true, force: true }); }
});
