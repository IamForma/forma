// Codex и Gemini (бета) ставятся установщиком: файлы адаптеров, роли, повторный запуск, config.toml проекта не затирается.
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

test('claude,codex,gemini: адаптеры Codex и Gemini установлены, сверка целостна', () => {
  const r = init('claude,codex,gemini');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const f of [
    '.codex/CODEX-8.md', '.codex/config.toml', '.codex/agents/intent.toml', '.codex/roles/kit.md', '.codex/hooks.json',
    '.agents/skills/grilling/SKILL.md',
    '.agents/rules/gemini-8.md', '.agents/forma-adapter.cjs', '.agents/plugins/forma/plugin.json', '.agents/plugins/forma/agents/kit.md', '.agents/plugins/forma/mcp_config.json',
  ]) assert.ok(fs.existsSync(path.join(dir, f)), f);
  assert.match(r.stdout, /Codex \(бета\)/);
  assert.match(r.stdout, /Gemini \(Antigravity, бета\)/);
  assert.match(r.stdout, /установка целостна/);
});

test('повторный запуск не затирает config.toml и mcp_config.json проекта', () => {
  const cfg = path.join(dir, '.codex', 'config.toml');
  const mcp = path.join(dir, '.agents', 'plugins', 'forma', 'mcp_config.json');
  fs.appendFileSync(cfg, '\n[mcp_servers.site]\ncommand = "x"\n');
  fs.writeFileSync(mcp, '{"mcpServers":{"site":{}}}');
  const r = init('claude,codex,gemini');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(fs.readFileSync(cfg, 'utf8'), /mcp_servers\.site/);
  assert.match(fs.readFileSync(mcp, 'utf8'), /"site"/);
});

test('только codex без Claude: ставится, sync-codex откладывается с предупреждением', () => {
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-engines2-'));
  try {
    const r = spawnSync(process.execPath, [FORMA, 'init', '--dir', d2, '--engines', 'codex', '--board', 'skip', '--yes'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(fs.existsSync(path.join(d2, '.codex', 'CODEX-8.md')));
    assert.match(r.stdout, /\.claude\/agents не найден/);
  } finally { fs.rmSync(d2, { recursive: true, force: true }); }
});
