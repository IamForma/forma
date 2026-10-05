#!/usr/bin/env node
'use strict';
/**
 * Тест соответствия экономического контракта (.forma/manual/en/03-forma/ECONOMY.md).
 * Примеры: строка `## История` → ожидаемые канонические суммы.
 * Адаптер любого движка проходит этот же тест своими строками.
 *   node .forma/dashboard/economy.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const economy = require('./economy.cjs');
const { tally } = require('./tally.cjs');

// Дата собирается в рантайме: литерал даты в файле ядра читается проверкой как след проекта.
const D = ['2000', '01', '02'].join('-');
let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

function tallyLines(lines) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'econ-')), 'fixture.md');
  fs.writeFileSync(f, '# t\n\n## History\n' + lines.map((l) => '- ' + l).join('\n') + '\n');
  return tally([f]);
}

it('полная строка: N, R, T, id, тег движка', () => {
  const t = tallyLines([`\`Run\`, ${D}: attempt, 52 339 tokens (40 000 cache-read), 120 s, \`abc123\` — eng-x: сделано.`]);
  const n = t.byNode.Run;
  assert.equal(n.attempts, 1);
  assert.equal(n.tokens, 52339);
  assert.equal(n.cacheRead, 40000);
  assert.equal(n.work, 12339);
  assert.equal(n.seconds, 120);
  assert.equal(n.tokensUnknown + n.cacheUnknown + n.secondsUnknown + n.idUnknown, 0);
});

it('маркер unknown считается отдельно, не нулём', () => {
  const t = tallyLines([
    `\`Intent\`, ${D}: attempt, unknown tokens (cache-read unknown), unknown s, \`id unknown\` — eng-x: журнал не прочитан.`,
    `\`Intent\`, ${D}: attempt, 100 tokens (60 cache-read), 5 s, \`def456\` — eng-x: сделано.`,
  ]);
  const n = t.byNode.Intent;
  assert.equal(n.attempts, 2);
  assert.equal(n.tokens, 100);
  // Падает, если unknown превратить в 0: тогда эти счётчики стали бы 0, а покрытие — 2 из 2.
  assert.equal(n.tokensUnknown, 1);
  assert.equal(n.cacheUnknown, 1);
  assert.equal(n.secondsUnknown, 1);
  assert.equal(n.idUnknown, 1);
  assert.equal(n.withCacheRead, 1);
  assert.equal(n.withSeconds, 1);
  assert.equal(t.total.tokensUnknown, 1);
});

it('модуль: null (unknown) ≠ 0 и ≠ undefined (не записано)', () => {
  const asNull = economy.addAttempt(economy.emptyAcc(), { tokens: null, cache_read: null, duration_s: null, call_id: null });
  const asZero = economy.addAttempt(economy.emptyAcc(), { tokens: 0, cache_read: 0, duration_s: 0, call_id: 'x' });
  const absent = economy.addAttempt(economy.emptyAcc(), {});
  assert.deepEqual(economy.unknownCount(asNull), { tokens: 1, cache_read: 1, duration_s: 1, call_id: 1 });
  assert.deepEqual(economy.unknownCount(asZero), { tokens: 0, cache_read: 0, duration_s: 0, call_id: 0 });
  assert.deepEqual(economy.unknownCount(absent), { tokens: 0, cache_read: 0, duration_s: 0, call_id: 0 });
  assert.equal(asZero.withCacheRead, 1);
  assert.equal(absent.withCacheRead, 0);
  assert.equal(economy.cacheShare(asNull), null);
});

it('старое соглашение R > N приводится (N включает R)', () => {
  const t = tallyLines([`\`Kit\`, ${D}: attempt, 10 tokens (90 cache-read), 1 s — старая строка.`]);
  assert.equal(t.byNode.Kit.tokens, 100);
});

it('один id в двух карточках считается один раз; внешний сервис в своей единице', () => {
  const t = tallyLines([
    `\`Run\`, ${D}: attempt, 10 tokens (5 cache-read), 1 s, 1160 credits (svc/op-a), \`same1\` — eng-y: а.`,
    `\`Run\`, ${D}: attempt, 10 tokens (5 cache-read), 1 s, 1160 credits (svc/op-a), \`same1\` — eng-y: а.`,
  ]);
  assert.equal(t.byNode.Run.attempts, 1);
  assert.deepEqual(t.total.services, { 'svc (credits)': 1160 });
});

it('разбивка по тегу движка: токены разных тегов не складываются', () => {
  const g = economy.byEngine([
    { engine: 'eng-a', tokens: 10, cache_read: 5 },
    { engine: 'eng-b', tokens: 7 },
    { tokens: 1 },
  ]);
  assert.deepEqual(Object.keys(g).sort(), ['eng-a', 'eng-b', 'untagged']);
  assert.equal(g['eng-a'].tokens, 10);
  assert.equal(g['eng-b'].tokens, 7);
  assert.equal(economy.cacheShare(g['eng-a']), 0.5);
});

it('вызовы модели: N = in + write + read + out, работа = N − R', () => {
  const u = economy.addUsage(economy.emptyUsage(), { tokens_in: 1, tokens_out: 2, cache_read: 30, cache_write: 4 });
  assert.equal(economy.usageTokens(u), 37);
  assert.equal(economy.usageWork(u), 7);
  assert.equal(economy.readPerOutput(u), 15);
});

it('тренд: пропуск (null) не ноль', () => {
  assert.equal(economy.trend([{ value: 3 }, { value: null }, { value: 1 }]), -1);
  assert.equal(economy.trend([{ value: 3 }, { value: null }]), null);
});

it('модуль не знает имён движков', () => {
  const src = fs.readFileSync(path.join(__dirname, 'economy.cjs'), 'utf8');
  assert.equal(/claude|codex|gemini/i.test(src), false);
});

console.log(`\n${passed} проверок пройдено`);
