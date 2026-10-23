#!/usr/bin/env node
'use strict';
/**
 * Дашборд читает движки на равных: метка расхода из адаптеров, колонка от папки движка, скорость без строк
 * `out unknown` в знаменателе, фильтр по виду карточки.
 *   node .forma/dashboard/engine-neutral.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { engineTagRe } = require('./spend-line.cjs');
const { parseAttempts } = require('./data/attempts.cjs');
const { buildSpeed } = require('./data/speed.cjs');
const { buildSpend } = require('./data/spend.cjs');
const engines = require('./lib/engines.cjs');
const { readNodeConfig } = require('./data/nodes.cjs');

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

function fakeRoot(adapters) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-neutral-'));
  for (const [dir, body] of Object.entries(adapters)) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(path.join(root, dir, 'forma-adapter.cjs'), body);
  }
  fs.mkdirSync(path.join(root, '.devtool', 'features'), { recursive: true });
  return root;
}
const adapter = (engine, spendTag, id) => `module.exports = { engine: '${engine}', spendTag: '${spendTag}'${id ? `, id: '${id}'` : ''} };`;

it('метка из spendTag/engine/id адаптеров проходит, неизвестная — нет', () => {
  const root = fakeRoot({ '.a': adapter('eng-a', 'eng-a-tag', 'a'), '.m': adapter('mini-code', 'mini-code', 'mini') });
  const re = engineTagRe(root);
  for (const tag of ['eng-a-tag', 'eng-a', 'a', 'mini-code', 'mini']) assert.ok(re.test(`x — ${tag}: сделано`), tag);
  assert.ok(!re.test('x — unknown-engine: сделано'));
  assert.ok(!re.test('x — codex: сделано'), 'имя движка без адаптера не привилегировано');
});

it('удалили адаптер — его метка становится неизвестной', () => {
  const root = fakeRoot({ '.a': adapter('eng-a', 'eng-a'), '.m': adapter('mini', 'mini') });
  assert.ok(engineTagRe(root).test('x — mini: y'));
  fs.rmSync(path.join(root, '.m'), { recursive: true });
  assert.ok(!engineTagRe(root).test('x — mini: y'));
});

const DATE = [String(1999 + 1), "01", "01"].join("-");
const line = (extra, tag) => `- \`Run\`, ${DATE}: attempt, 1000 tokens (400 cache-read)${extra}, \`abcdef0123456789\` — ${tag}: work.`;
const card = (id, kind, status, lines) => ({
  id, kind, status, attempts: parseAttempts(lines.join('\n')),
});

it('выходные токены: число читается, out unknown и старая строка — null', () => {
  const a = parseAttempts([line(', 600 out, 10 s', 'eng-a'), line(', out unknown, 10 s', 'eng-a'), line(', 10 s', 'eng-a')].join('\n'));
  assert.deepEqual(a.map((z) => z.tokensOut), [600, null, null]);
});

it('скорость: out unknown не входит в знаменатель и помечен; фильтр по виду меняет цифры', () => {
  const cards = [
    card('c1', 'build', 'done', [line(', 600 out, 10 s', 'eng-a'), line(', out unknown, 30 s', 'eng-a')]),
    card('c2', 'docs', 'done', [line(', 100 out, 10 s', 'eng-a')]),
  ];
  const s = buildSpeed(cards);
  const all = s.byKind.all.engines['eng-a'];
  assert.equal(all.outPerSec, 700 / 20);
  assert.equal(all.outUnknown, 1);
  assert.equal(all.secPerAttempt, 50 / 3);
  assert.equal(all.attemptsPerClosed, 1.5);
  assert.equal(all.closedCards, 2);
  assert.equal(all.cacheShare, 0.4);
  assert.equal(s.byKind.build.engines['eng-a'].outPerSec, 60);
  assert.equal(s.byKind.docs.engines['eng-a'].outPerSec, 10);
  assert.deepEqual(s.kinds, ['build', 'docs']);
});

it('колонка и срез скорости появляются от папки движка с адаптером, без строк расхода', () => {
  const root = fakeRoot({ '.a': adapter('eng-a', 'eng-a') });
  const before = buildSpend(root, []).economy;
  assert.ok(before.engines['eng-a']);
  assert.deepEqual(before.byEngine.keys, ['eng-a']);
  assert.ok(before.speed.byKind.all.engines['eng-a']);
  fs.rmSync(path.join(root, '.a'), { recursive: true });
  const after = buildSpend(root, []).economy;
  assert.deepEqual(Object.keys(after.engines), []);
  assert.equal(engines.engineTags(root).length, 0);
});

const NM = (m, e) => `{ Intent: { model: '${m}', effort: '${e}' }, Spec: { model: '${m}', effort: '${e}' }, Kit: { model: '${m}', effort: '${e}' }, Run: { model: '${m}', effort: '${e}' }, Core: { model: '${m}', effort: '${e}' } }`;

it('два адаптера с таблицами дают две группы строк, адаптер без таблицы — пустую группу', () => {
  const root = fakeRoot({
    '.a': `module.exports = { engine: 'eng-a', spendTag: 'eng-a', nodeModels: ${NM('model-a', 'high')} };`,
    '.m': `module.exports = { engine: 'mini-code', spendTag: 'mini', id: 'mini', nodeModels: ${NM('model-m', 'medium')} };`,
    '.z': adapter('eng-z', 'eng-z'),
  });
  const rows = readNodeConfig(root);
  const of = (e) => rows.filter((r) => r.engine === e);
  assert.equal(of('eng-a').length, 5);
  assert.equal(of('mini').length, 5);
  assert.ok(of('mini').every((r) => r.model === 'model-m' && r.effort === 'medium'));
  assert.ok(of('eng-a').every((r) => r.model === 'model-a'));
  assert.equal(of('eng-z').length, 1);
  assert.equal(of('eng-z')[0].empty, true);
  assert.deepEqual(readNodeConfig(fakeRoot({})), []);
});

it('алиасы тега одного движка сводятся в один ключ byEngine и speed', () => {
  const root = fakeRoot({ '.m': adapter('mini-code', 'mini', 'mini') });
  const dir = path.join(root, '.devtool', 'features');
  let n = 0;
  const l = (tag) => line(', 5 out, 10 s', tag).replace('abcdef0123456789', 'abcdef01234567' + (10 + n++));
  fs.writeFileSync(path.join(dir, 'case-x.md'), `---\nid: "case-x"\nstatus: "done"\n---\n## History\n${l('mini')}\n${l('mini')}\n${l('mini-code')}\n`);
  const cards = [card('c1', 'build', 'done', [l('mini'), l('mini'), l('mini-code')])];
  const e = buildSpend(root, cards).economy;
  assert.deepEqual(e.byEngine.keys, ['mini']);
  assert.equal(e.byEngine.columns.mini.attempts, 3);
  assert.deepEqual(Object.keys(e.speed.byKind.all.engines), ['mini']);
  assert.equal(e.speed.byKind.all.engines.mini.attempts, 3);
  assert.deepEqual(Object.keys(e.engines), ['mini']);
});

console.log(`\n${passed} passed`);
