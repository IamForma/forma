#!/usr/bin/env node
'use strict';
// Обратная сверка ledger-parity: строка расхода карточки → журнал вызовов. Фикстура во временном каталоге.
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../../.forma/board/checks/ledger-parity.cjs');

const D1 = ['2000', '01', '02'].join('-');
const D2 = ['2000', '01', '03'].join('-');
const SINCE = ['2000', '01', '01'].join('-');
const FIX = 'c' + 'ard-000';

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

function fixture(ledgerLines, cardLines) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-rev-'));
  fs.mkdirSync(path.join(root, '.devtool', 'features'), { recursive: true });
  fs.mkdirSync(path.join(root, '.agents', '.ledger'), { recursive: true });
  fs.writeFileSync(path.join(root, '.agents', 'forma-adapter.cjs'), "module.exports = { engine: 'gemini' };\n");
  fs.writeFileSync(path.join(root, '.agents', '.ledger', 'calls.jsonl'), ledgerLines.map((l) => JSON.stringify(l)).join('\n') + (ledgerLines.length ? '\n' : ''));
  fs.writeFileSync(path.join(root, '.devtool', 'features', FIX + '-t.md'), '# t\n\n## History\n' + cardLines.map((l) => '- ' + l).join('\n') + '\n');
  return root;
}
const row = (d, id) => '`Run`, ' + d + ': attempt, 100 tokens (10 cache-read), 5 out, 1 s, ' + id + ' — gemini: x';
const call = (d, id) => ({ timestamp: d + 'T10:00:00Z', conversationId: id });

it('id вне журнала, дата позже первого дня журнала — находка; id из журнала — нет', () => {
  const root = fixture([call(D1, 'conv-in-ledger')], [row(D2, '`conv-in-ledger`'), row(D2, '`conv-missing-1`')]);
  const p = run({ root, since: SINCE });
  assert.equal(p.length, 1);
  assert.match(p[0], /conv-missing-1/);
  assert.doesNotMatch(p[0], /conv-in-ledger.*вызова нет/);
});

it('id unknown пропущена; строка дня установки журнала пропущена; строка раньше since пропущена', () => {
  const root = fixture([call(D1, 'conv-in-ledger')], [
    row(D2, '`id unknown`'),
    row(D1, '`conv-same-day-1`'),
    row(['1999', '12', '31'].join('-'), '`conv-old-1`'),
    row(D2, '`conv-in-ledger`'),
  ]);
  assert.deepEqual(run({ root, since: SINCE }), []);
});

it('пустой журнал при строках расхода движка — находка, а не молчание', () => {
  const root = fixture([], [row(D2, '`conv-x-1`')]);
  const p = run({ root, since: SINCE });
  assert.equal(p.length, 1);
  assert.match(p[0], /пуст/);
});

it('пустой журнал без строк расхода движка — тихо', () => {
  const root = fixture([], []);
  assert.deepEqual(run({ root, since: SINCE }), []);
});

console.log(`\n${passed} проверок обратной сверки пройдено`);
