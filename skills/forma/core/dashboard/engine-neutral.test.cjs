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

console.log(`\n${passed} passed`);
