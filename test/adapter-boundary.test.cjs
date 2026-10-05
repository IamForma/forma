// Граница ядро — адаптер (dashboard/lib/engines.cjs): дашборд на проекте без адаптера собирается,
// а всё, что знает только движок, приходит как `unknown`. Тест падает, если ядро берёт данные движка
// мимо интерфейса: фикстура остаётся с каталогами `.claude/agents`, `.claude/scripts`, `.claude/settings.json`,
// и только сам `forma-adapter.cjs` выключен — прямое чтение вернуло бы настоящие данные.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture, runNode } = require('./helpers/fixture.cjs');
const { buildDataRaw } = require('./helpers/snapshot.cjs');

const ADAPTER = ['.claude', 'forma-adapter.cjs'];
let fx;
const adapterFile = () => path.join(fx.root, ...ADAPTER);
const exists = (...p) => fs.existsSync(path.join(fx.root, ...p));

test.before(() => { fx = makeFixture(); });
test.after(() => { if (fx) fx.cleanup(); });

// Узлы расхода по движкам: там лежат вес шага и число шагов.
const engineNodes = (d) => Object.values(d.economy.engines).flatMap((e) => e.byNode);

// Что движок знает лишь сам: то, что должно исчезнуть из данных вместе с адаптером.
function engineFacts(d) {
  return {
    instruction: d.economy.instruction,
    perStep: [...new Set(engineNodes(d).map((n) => n.instructionPerStep))],
    settings: d.settings.engine,
    bortSource: d.bort.source,
    servers: d.bort.servers.length + d.bort.mcpScanned.length,
    nodeConfig: d.nodeConfig.length,
    law: { engine: d.board.law.engine, roles: d.board.law.roles.length, checks: d.board.law.checks.length },
    skillDirs: d.settings.project.skillDirs,
    skills: Object.keys(d.board.skills).length,
    groups: d.structure.groups.map((g) => g.key),
  };
}

test('с адаптером ядро получает данные движка (контрольная половина)', () => {
  assert.ok(exists(...ADAPTER), 'установщик не поставил forma-adapter.cjs');
  const d = buildDataRaw(fx);
  const f = engineFacts(d);
  assert.equal(typeof f.instruction, 'object');
  assert.ok(f.settings.present && f.settings.nodes.length > 0);
  assert.ok(f.nodeConfig > 0 && f.law.roles > 0 && f.law.checks > 0 && f.law.engine.length > 0);
  assert.equal(typeof f.skillDirs, 'number');
  assert.ok(f.groups.includes('model'));
  // Признак умений: всё, что поставил установщик, — ядро; «проект» — только у умения, которого шаблон не поставлял.
  const rows = d.settings.project.skills.rows;
  assert.ok(rows.length > 0 && rows.every((r) => r[1] === 'ядро'), JSON.stringify(rows.map((r) => r.slice(0, 2))));
  const own = path.join(fx.root, '.claude', 'skills', 'own-skill');
  fs.mkdirSync(own, { recursive: true });
  fs.writeFileSync(path.join(own, 'SKILL.md'), '---\nname: own-skill\ndescription: своё\n---\n');
  const after = buildDataRaw(fx).settings.project.skills.rows;
  assert.deepEqual(after.find((r) => r[0] === 'own-skill').slice(0, 2), ['own-skill', 'проект']);
  fs.rmSync(own, { recursive: true, force: true });
});

test('без адаптера: сборка идёт, движковые поля unknown или пусты, ноль и null на их место не встают', () => {
  fs.renameSync(adapterFile(), adapterFile() + '.off');
  // Данные движка на диске на месте — прямое чтение ядром их бы нашло.
  assert.ok(exists('.claude', 'agents', 'kit.md') && exists('.claude', 'settings.json') && exists('.claude', 'scripts', 'instruction-weight.cjs'));
  const d = buildDataRaw(fx);
  const f = engineFacts(d);
  assert.equal(f.instruction, 'unknown');
  assert.deepEqual(f.perStep, ['unknown']);
  assert.ok(engineNodes(d).length > 0 && engineNodes(d).every((n) => n.avgSteps === 'unknown'));
  assert.equal(f.settings.present, false);
  assert.equal(f.settings.engine, 'unknown');
  assert.deepEqual([f.settings.hooks, f.settings.nodes, f.settings.skills, f.settings.env], [[], [], [], []]);
  assert.equal(f.bortSource, null);
  assert.equal(f.servers, 0);
  assert.equal(f.nodeConfig, 0);
  assert.deepEqual(f.law, { engine: '', roles: 0, checks: 0 });
  assert.equal(f.skillDirs, 'unknown');
  assert.equal(f.skills, 0);
  assert.ok(!f.groups.includes('model'));
});

test('без адаптера tally называет пол недоступным, а не нулём', () => {
  const cards = path.join(fx.root, '.devtool', 'features');
  const r = runNode(fx, [path.join(fx.root, '.forma', 'dashboard', 'tally.cjs'), '--report', cards]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /недоступен — пол не назван, и это не ноль/);
  assert.doesNotMatch(r.stdout, /Из них общая часть/);
});

test('адаптер, который бросает при загрузке, — не адаптер: сборка идёт, поля unknown', () => {
  fs.writeFileSync(adapterFile(), "throw new Error('адаптер сломан');\n");
  const f = engineFacts(buildDataRaw(fx));
  assert.equal(f.instruction, 'unknown');
  assert.equal(f.settings.present, false);
});

test('адаптер объявил не всё: недостающее поле — unknown, остальное работает', () => {
  fs.writeFileSync(adapterFile(), "module.exports = { engine: 'test-engine', skillsDir: '.claude/skills' };\n");
  const d = buildDataRaw(fx);
  const f = engineFacts(d);
  assert.equal(f.instruction, 'unknown');
  assert.equal(typeof f.skillDirs, 'number');
  assert.equal(f.settings.engine, 'test-engine');
  assert.equal(f.settings.present, false);
  // Списка умений шаблона нет — признак «—», а не молчаливое «проект».
  const rows = d.settings.project.skills.rows;
  assert.ok(rows.length > 0 && rows.every((r) => r[1] === '—'));
});
