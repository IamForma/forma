'use strict';

// Строка заявляет себя записью расхода (есть «ДАТА: attempt,») и под формат §3 не подходит — значит расход был,
// а в счёт не попал. Заявка — CLAIM_LINE_RE; полный формат — PARSES_RE (тот же, что у разборщика дашборда).
// Чаще всего дело не в числах, а в подписи узла: формат ждёт `Узел` в самом начале строки, и число за пояснением
// уже не читается ничем, молча.

const { toEnglish, CLAIM_LINE_RE, PARSES_RE } = require('../../dashboard/spend-line.cjs');
const { cardLines, bulletList } = require('./support/lines.cjs');

function run({ root }) {
  const bad = [];
  for (const { file, line } of cardLines(root)) {
    const t = toEnglish(line.trim());
    if (CLAIM_LINE_RE.test(t) && !PARSES_RE.test(t)) bad.push(`${file}: ${t.replace(/^-\s*/, '').slice(0, 90)}`);
  }
  if (!bad.length) return [];
  return [`${bad.length} записей расхода не разбираются и в счёт не попадают ` +
    `(форма «ДАТА: attempt,» есть, формат §3 не соблюдён):\n      ` + bulletList(bad)];
}

module.exports = { id: 'attempt-parses', since: null, run };
