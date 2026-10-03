'use strict';

// Язык ключевой части строки расхода. Ключевая часть (всё до тире) — только по-английски, при любом языке проекта
// (AGENTS.md §3): `attempt, N tokens (R cache-read), T s, `<id>``. Описание после тире — на языке карточки.
// Старые русские строки («заход, N токенов…») счётчики читают и дальше; не переписываются (запрет 5).
// Отклонением называется только строка, датированная ПОЗЖЕ дня вступления правила.

const { RU_CLAIM_LINE_RE, EN_CLAIM_LINE_RE, isNonCanonical } = require('../../dashboard/spend-line.cjs');
const { cardLines, bulletList } = require('./support/lines.cjs');

function run({ root, since }) {
  const bad = [];
  for (const { file, line } of cardLines(root)) {
    const t = line.trim();
    const m = RU_CLAIM_LINE_RE.exec(t) || EN_CLAIM_LINE_RE.exec(t);
    if (!m || m[1] <= since) continue;
    if (isNonCanonical(t)) bad.push(`${file}: ${t.replace(/^-\s*/, '').slice(0, 90)}`);
  }
  if (!bad.length) return [];
  return [`ключевая часть строки расхода не по-английски у ${bad.length} записей после ${since} ` +
    `(§3: attempt, N tokens (R cache-read), T s, \`<id>\` — описание на языке карточки):\n      ` + bulletList(bad)];
}

module.exports = { id: 'spend-language', since: 'spend-english', run };
