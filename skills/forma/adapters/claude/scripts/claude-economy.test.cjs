#!/usr/bin/env node
'use strict';
/**
 * Соответствие адаптера Claude контракту (.forma/manual/en/03-forma/ECONOMY.md): строки, собранные
 * адаптером, читаются tally.cjs в те же канонические суммы; отсутствующее у Claude — unknown, не 0.
 * Общий тест контракта — .forma/dashboard/economy.test.cjs, этот идёт вместе с ним.
 *   node .claude/scripts/claude-economy.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { claudeUsage, fromAgentResult } = require('./claude-economy.cjs');
const { formatSpendLine } = require('../../.forma/dashboard/spend-line.cjs');
const { tally } = require('../../.forma/dashboard/tally.cjs');

const D = ['2000', '01', '02'].join('-');
let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };
const tallyLines = (lines) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'claude-econ-')), 'fixture.md');
  fs.writeFileSync(f, '# t\n\n## History\n' + lines.map((l) => '- ' + l).join('\n') + '\n');
  return tally([f]);
};
const line = (rec) => formatSpendLine({ node: 'Run', date: D, engine: 'claude-code', desc: 'x.', ...rec });

it('<usage> + стенограмма → N, R, T, id; tally читает те же числа', () => {
  const rec = fromAgentResult({ agent_id: 'a1b2', subagent_tokens: 52339, tool_uses: 7, duration_ms: 120499 },
    { cacheRead: 40000, cacheCreate: 900, input: 10, output: 300 });
  assert.deepEqual([rec.tokens, rec.cache_read, rec.duration_s, rec.call_id, rec.tool_uses], [52339, 40000, 120, 'a1b2', 7]);
  const n = tallyLines([line(rec)]).byNode.Run;
  assert.equal(n.tokens, 52339);
  assert.equal(n.cacheRead, 40000);
  assert.equal(n.seconds, 120);
  assert.equal(n.tokensUnknown + n.cacheUnknown + n.secondsUnknown + n.idUnknown, 0);
});

it('нет стенограммы: cache_read и cache_write — unknown (null), не 0; tally считает отдельно', () => {
  const rec = fromAgentResult({ agent_id: 'a1b2', subagent_tokens: 100, duration_ms: 5000 }, null);
  // Падает, если адаптер вернёт 0: `<usage>` Claude не несёт ни R, ни cache_write.
  assert.equal(rec.cache_read, null);
  assert.equal(rec.cache_write, null);
  assert.equal(rec.tokens_in, null);
  assert.equal(rec.tool_uses, null);
  const s = line(rec);
  assert.match(s, /\(cache-read unknown\)/);
  const n = tallyLines([s]).byNode.Run;
  assert.equal(n.cacheUnknown, 1);
  assert.equal(n.withCacheRead, 0);
});

it('пустые поля <usage> → unknown tokens / unknown s / id unknown', () => {
  const s = line(fromAgentResult({}, null));
  assert.match(s, /attempt, unknown tokens \(cache-read unknown\), unknown s, `id unknown` —/);
  const n = tallyLines([s]).byNode.Run;
  assert.deepEqual([n.tokensUnknown, n.cacheUnknown, n.secondsUnknown, n.idUnknown], [1, 1, 1, 1]);
});

it('шаг транскрипта: поле отсутствует — null, присутствует 0 — 0', () => {
  const u = claudeUsage({ input_tokens: 0, output_tokens: 5, cache_read_input_tokens: 9 });
  assert.deepEqual(u, { tokens_in: 0, tokens_out: 5, cache_read: 9, cache_write: null });
});

console.log(`\n${passed} проверок пройдено`);
