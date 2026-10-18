// scripts/template-push.cjs: публикация обезличенных файлов проекта в шаблон проекта.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'template-push.cjs');
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tpush-'));
  const proto = path.join(root, '.forma/protocol');
  fs.mkdirSync(path.join(proto, '.git'), { recursive: true });
  write(path.join(proto, '.claude-plugin/plugin.json'), JSON.stringify({ version: '1.2.3-alpha' }));
  const tpl = path.join(proto, 'templates/tpl');
  write(path.join(tpl, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'tpl', version: '0.0.1' }));
  write(path.join(tpl, 'README.md'), '# tpl\n<!-- inventory:start -->\nold\n<!-- inventory:end -->\ntail\n');
  write(path.join(tpl, 'skills/tpl/SKILL.md'), '---\nname: tpl\ndescription: the installer\n---\n');
  write(path.join(root, '.claude/scripts/shot.cjs'), '#!/usr/bin/env node\n// takes a screenshot\n\'use strict\';\nconst k = "SECRETVALUE99";\n');
  write(path.join(root, '.claude/agents/run/run-x.md'), '---\nname: run-x\ndescription: Run — does x\n---\n');
  write(path.join(root, '.env'), 'API_KEY=SECRETVALUE99\nSITE_URL=https://shop.example.test/x\n');
  write(path.join(root, 'home/.claude.json'), JSON.stringify({ mcpServers: { wp: { type: 'http', url: 'https://shop.example.test/wp-json/mcp', headers: { Authorization: 'Bearer ZZZZ' } } } }));
  return root;
}
const run = (root, ...args) => spawnSync(process.execPath, [SCRIPT, '--template', 'tpl', ...args], {
  cwd: root, encoding: 'utf8', env: { ...process.env, HOME: path.join(root, 'home'), USERPROFILE: path.join(root, 'home') },
});
const tplFile = (root, p) => path.join(root, '.forma/protocol/templates/tpl', p);

test('dry-run ничего не пишет', () => {
  const root = fixture();
  const r = run(root, '--add', '.claude/scripts/shot.cjs');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /новый\s+\.claude\/scripts\/shot\.cjs/);
  assert.equal(fs.existsSync(tplFile(root, 'skills/tpl/template/scripts/shot.cjs')), false);
  assert.equal(JSON.parse(fs.readFileSync(tplFile(root, '.claude-plugin/plugin.json'), 'utf8')).version, '0.0.1');
});

test('--apply: обезличивание, версия, CHANGELOG и «Состав»', () => {
  const root = fixture();
  const r = run(root, '--add', '.claude/scripts/shot.cjs', '--add', '.claude/agents/run/run-x.md', '--mcp', 'wp=site', '--note', 'First publish.', '--apply');
  assert.equal(r.status, 0, r.stderr);
  const script = fs.readFileSync(tplFile(root, 'skills/tpl/template/scripts/shot.cjs'), 'utf8');
  assert.match(script, /\[\[API_KEY\]\]/);
  assert.doesNotMatch(script, /SECRETVALUE99/);
  const mcp = fs.readFileSync(tplFile(root, 'skills/tpl/template/mcp.json'), 'utf8');
  assert.doesNotMatch(mcp, /shop\.example\.test|ZZZZ/);
  assert.deepEqual(JSON.parse(mcp).servers.site, { type: 'http', urlTemplate: 'https://<site-host>/wp-json/mcp', headerNames: ['Authorization'] });
  assert.equal(JSON.parse(fs.readFileSync(tplFile(root, '.claude-plugin/plugin.json'), 'utf8')).version, '0.0.2');
  const log = fs.readFileSync(tplFile(root, 'CHANGELOG.md'), 'utf8');
  assert.match(log, /## 0\.0\.2\n\nFirst publish\.\n\n- Added: `scripts\/shot\.cjs`/);
  assert.doesNotMatch(log, /\b20\d\d-\d\d-\d\d\b/);
  const readme = fs.readFileSync(tplFile(root, 'README.md'), 'utf8');
  assert.match(readme, /Template version \*\*0\.0\.2\*\*, assembled against protocol \*\*1\.2\.3-alpha\*\*/);
  assert.match(readme, /\| `shot\.cjs` \| takes a screenshot \|/);
  assert.match(readme, /\| `run-x` \| does x \|/);
  assert.match(readme, /\| `site` \| http \| Authorization \|/);
  assert.match(readme, /<!-- inventory:end -->\ntail/);
});

test('повтор без изменений не поднимает версию', () => {
  const root = fixture();
  run(root, '--add', '.claude/scripts/shot.cjs', '--apply');
  const r = run(root, '--add', '.claude/scripts/shot.cjs', '--apply');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Записывать нечего/);
  assert.equal(JSON.parse(fs.readFileSync(tplFile(root, '.claude-plugin/plugin.json'), 'utf8')).version, '0.0.2');
});

test('след проекта — отказ, ничего не записано', () => {
  const root = fixture();
  write(path.join(root, '.claude/scripts/bad.cjs'), '// mail ' + 'dev' + '@' + 'corp.test\n');
  const r = run(root, '--add', '.claude/scripts/shot.cjs', '--add', '.claude/scripts/bad.cjs', '--apply');
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /email/);
  assert.equal(fs.existsSync(tplFile(root, 'skills/tpl/template/scripts/shot.cjs')), false);
});

test('продуктовые зоны и пути вне зон отклоняются', () => {
  const root = fixture();
  assert.equal(run(root, '--add', 'project/config/SITE.md').status, 1);
  assert.equal(run(root, '--add', '.claude/hooks/x.sh').status, 1);
});
