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
  for (const f of ['rolesDir', 'onDemandRolesDir', 'engineRulesFile', 'skillsDir', 'syncScript', 'doneCardsGraphScript']) {
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
  const real = dirs.flatMap((d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)).sort();
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

console.log(`\n${passed} проверок пройдено`);
