#!/usr/bin/env node
'use strict';
/**
 * Вкладки движков на «Форме»: по вкладке на каждый адаптер с полем `formaRoles`.
 * Корень — временный, адаптеры фальшивые.
 *   node .forma/dashboard/forma-tabs.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readFormaCatalog } = require('./data/forma.cjs');
const { parseToml, readTomlCatalog, readMdCatalog } = require('./lib/forma-roles.cjs');

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

function fakeRoot(adapters) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-tabs-'));
  for (const [dir, body] of Object.entries(adapters)) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(path.join(root, dir, 'forma-adapter.cjs'), body);
  }
  return root;
}
const ok = (engine, title) => `module.exports = { engine: '${engine}', formaRoles: () => ({ title: '${title}', nodes: [], runRoles: [] }) };`;

it('три адаптера → три вкладки, Claude первым', () => {
  const root = fakeRoot({ '.a': ok('eng-a', 'A'), '.b': ok('claude-code', 'B'), '.c': ok('eng-c', 'C') });
  const tabs = readFormaCatalog(root).engines;
  assert.deepEqual(tabs.map((t) => t.engine), ['claude-code', 'eng-a', 'eng-c']);
});

it('убрали адаптер → две вкладки', () => {
  const root = fakeRoot({ '.a': ok('eng-a', 'A'), '.c': ok('eng-c', 'C') });
  assert.equal(readFormaCatalog(root).engines.length, 2);
});

it('адаптер без formaRoles вкладки не получает', () => {
  const root = fakeRoot({ '.a': "module.exports = { engine: 'eng-a' };" });
  assert.equal(readFormaCatalog(root).engines.length, 0);
});

it('адаптер, чей formaRoles бросил, пропущен; остальные живут', () => {
  const root = fakeRoot({ '.a': "module.exports = { engine: 'x', formaRoles: () => { throw new Error('boom'); } };", '.c': ok('eng-c', 'C') });
  assert.deepEqual(readFormaCatalog(root).engines.map((t) => t.engine), ['eng-c']);
});

it('toml: значения верхнего уровня, многострочная строка пропущена', () => {
  const { top, tables } = parseToml('name = "kit"\nmodel = "m-1" # c\nmodel_reasoning_effort = "medium"\ndeveloper_instructions = """\nmodel = "bad"\n"""\n[mcp_servers.site]\nurl = "x"\n');
  assert.equal(top.model, 'm-1');
  assert.equal(top.model_reasoning_effort, 'medium');
  assert.deepEqual(tables, ['mcp_servers.site']);
});

it('Codex: узлы из toml, у Run одна роль и пометка про каталог', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-toml-'));
  fs.mkdirSync(path.join(root, 'ag'));
  for (const n of ['kit', 'run']) fs.writeFileSync(path.join(root, 'ag', n + '.toml'), `name = "${n}"\nmodel = "m-${n}"\nmodel_reasoning_effort = "low"\n`);
  const cat = readTomlCatalog(root, { title: 'T', agentsDir: 'ag' });
  assert.deepEqual(cat.nodes.map((n) => n.name), ['Kit']);
  assert.equal(cat.runRoles.length, 1);
  assert.equal(cat.runRoles[0].model, 'm-run');
  assert.match(cat.runNote, /нет каталога ролей Run/);
});

it('нет каталога ролей → rolesMissing, не падение', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-none-'));
  assert.equal(readTomlCatalog(root, { title: 'T', agentsDir: 'x' }).rolesMissing, true);
  assert.equal(readMdCatalog(root, { title: 'T', rolesDir: 'x', mcpFiles: [] }).rolesMissing, true);
});

console.log(`\n${passed} passed`);
