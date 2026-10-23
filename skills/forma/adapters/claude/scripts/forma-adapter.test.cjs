#!/usr/bin/env node
'use strict';
/**
 * Соответствие адаптера Claude форме интерфейса ядро — адаптер (шапка `.forma/dashboard/lib/engines.cjs`):
 * ядро находит адаптер по имени файла, каждое объявленное поле есть и своего типа, значения читаются.
 * Общий контракт экономики — `claude-economy.test.cjs`; этот идёт вместе с ним.
 *   node .claude/scripts/forma-adapter.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const engines = require('../../.forma/dashboard/lib/engines.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };
const adapter = () => engines.loadAdapters(ROOT).find((a) => a.dir === '.claude');

it('ядро находит адаптер по имени файла, без имени движка', () => {
  const a = adapter();
  assert.ok(a, 'в корне проекта нет .claude/forma-adapter.cjs, который загружается');
  assert.equal(a.engine, 'claude-code');
});

it('форма: каждое объявленное поле есть и своего типа, лишних нет', () => {
  const a = adapter();
  assert.deepEqual(engines.validateAdapter(a), []);
  // Эталонный адаптер объявляет всю форму: пропавшее поле ядро молча заменило бы на unknown.
  const missing = Object.keys(engines.SHAPE).filter((f) => a[f] == null);
  assert.deepEqual(missing, []);
});

it('проверка формы отличает порчу: не тот тип и лишнее поле называются', () => {
  const bad = engines.validateAdapter({ rolesDir: 5, придумка: true });
  assert.equal(bad.length, 2);
  assert.match(bad[0], /rolesDir/);
});

it('пути адаптера — от корня проекта, и они существуют', () => {
  const a = adapter();
  for (const f of ['rolesDir', 'onDemandRolesDir', 'engineRulesFile', 'skillsDir', 'syncScript']) {
    assert.ok(fs.existsSync(engines.resolveRel(ROOT, a[f])), `${f}: ${a[f]} не найден`);
  }
  for (const r of a.usageRefresh) assert.ok(fs.existsSync(engines.resolveRel(ROOT, r.script)), `usageRefresh: ${r.script}`);
});

it('список умений шаблона: совпадает с тем, что лежит в шаблоне (где клон .forma/protocol/ есть)', () => {
  const a = adapter();
  assert.ok(Array.isArray(a.templateSkills) && a.templateSkills.length > 0);
  const base = path.join(ROOT, '.forma/protocol', 'skills', 'forma');
  const dirs = [path.join(base, 'adapters', 'claude', 'skills'), path.join(base, 'core', 'skills')];
  if (!dirs.every((d) => fs.existsSync(d))) return; // установленный проект без клона: сверять не с чем
  const real = [...new Set(dirs.flatMap((d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)))].sort(); // умение может лежать и в adapters/claude, и в core
  assert.deepEqual([...a.templateSkills].sort(), real);
});

it('вес инструкций: по узлам шаг — число; шагов без кэш-чтения нет — null, не 0', () => {
  const a = adapter();
  const w = a.instructionWeight();
  assert.ok(Object.keys(w.byNode).length > 0);
  for (const v of Object.values(w.byNode)) assert.equal(typeof v.perStep, 'number');
  assert.equal(a.stepsFromCacheRead(0, 100), null);
  assert.equal(a.stepsFromCacheRead(1000, 100), 10);
});

it('расход: шаг стенограммы читается в канонические поля, недостающее — null', () => {
  const u = adapter().parseUsage({ input_tokens: 3, cache_read_input_tokens: 7 });
  assert.deepEqual(u, { tokens_in: 3, tokens_out: null, cache_read: 7, cache_write: null });
  const dir = adapter().transcriptsDir(ROOT);
  assert.ok(dir === null || typeof dir === 'string');
});

it('журнал инструментов: разбор читает объявленное и голое имя инструмента', () => {
  const t = adapter().toolUsage;
  assert.equal(t.baseName('Bash(node x *)'), 'Bash');
  assert.ok(t.readDeclared(engines.resolveRel(ROOT, adapter().rolesDir)) instanceof Map);
  assert.ok(fs.existsSync(engines.resolveRel(ROOT, t.source)));
});

it('MCP-конфиги и настройки движка: заявленная форма записей', () => {
  const a = adapter();
  for (const c of a.mcpConfigs(ROOT)) assert.deepEqual(Object.keys(c).sort(), ['file', 'level', 'rel']);
  const s = a.engineSettings(ROOT);
  assert.deepEqual(Object.keys(s).sort(), ['check', 'env', 'hooks', 'mcp', 'nodes', 'plugins', 'present', 'skills']);
  assert.deepEqual(Object.keys(s.mcp).sort(), ['project', 'user', 'userProject']);
});

it('формa ролей: заголовок, узлы и роли Run, плагины', () => {
  const c = adapter().formaRoles(ROOT);
  assert.ok(c.title && Array.isArray(c.nodes) && Array.isArray(c.runRoles));
  assert.ok(c.nodes.length > 0);
  assert.ok(c.plugins && typeof c.plugins.ran === 'boolean');
});

it('структура: группа с ключом, названием, корнями и подписями', () => {
  const s = adapter().structure;
  assert.ok(s.key && s.title && Array.isArray(s.roots) && s.roots.length);
  assert.equal(typeof s.notes, 'object');
});

it('контракт движка: объявленные sources отдаются как есть, без sources — по соглашению', () => {
  const claude = engines.sourcesOf(adapter());
  assert.equal(claude.rolesDir, '.claude/agents');
  assert.equal(claude.runRolesDir, '.claude/agents/run');
  const gemini = engines.sourcesOf(engines.loadAdapters(ROOT).find((a) => a.dir === '.agents'));
  assert.equal(gemini.rolesDir, '.agents/plugins/forma/agents'); // объявлено, не соглашение (.agents/agents)
  const minimax = engines.sourcesOf(engines.loadAdapters(ROOT).find((a) => a.dir === '.minimax'));
  assert.equal(minimax.rolesDir, '.minimax/agents');
  const bare = engines.sourcesOf({ dir: '.demo' });
  assert.deepEqual([bare.rolesDir, bare.skillsDir, bare.packageManifest, bare.mcpConfigs], ['.demo/agents', '.demo/skills', null, []]);
  assert.equal(engines.idOf({ dir: '.demo' }), 'demo');
  assert.equal(engines.idOf({ dir: '.demo', id: 'x' }), 'x');
});

it('контракт движка: без вызова субагентов режим «деградированный»', () => {
  assert.equal(engines.modeOf(adapter()), 'полный');
  assert.equal(engines.modeOf({ capabilities: { subagents: false } }), 'деградированный');
  assert.equal(engines.modeOf({}), 'деградированный');
});

it('контракт движка: check печатает пункты и выходит с кодом 1 на непройденном', () => {
  const { spawnSync } = require('child_process');
  const lib = path.join(ROOT, '.forma', 'dashboard', 'lib', 'engines.cjs');
  const ok = spawnSync(process.execPath, [lib, 'check', 'claude-code'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(ok.status, 0);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'engine-check-'));
  fs.mkdirSync(path.join(tmp, '.bad'));
  fs.writeFileSync(path.join(tmp, '.bad', 'forma-adapter.cjs'),
    "module.exports = { engine: 'bad', sources: { rolesDir: '.bad/agents' }, writeZones: ['.other'] };");
  const bad = spawnSync(process.execPath, [lib, 'check', 'bad', '--root', tmp], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /✗ sources\.rolesDir существует/);
  assert.match(bad.stdout, /✗ writeZones/);
  assert.equal(spawnSync(process.execPath, [lib, 'check', 'nope', '--root', tmp], { encoding: 'utf8' }).status, 2);
});

console.log(`\n${passed} проверок пройдено`);
