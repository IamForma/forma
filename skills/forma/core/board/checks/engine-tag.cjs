'use strict';

// §3 и ECONOMY.md («`Intent` in the shared session»): у строки захода описание открывается меткой движка, а `0 tokens` числом — нарушение:
// ноль допустим только маркером `unknown tokens` с причиной, событие без работы пишется без `attempt`.
// Граница — строго позже дня вступления, по той же причине, что у проверки `agent-id`.

const { toEnglish, SPEND_TOKENS_OR_UNKNOWN_RE, ENGINE_TAG_RE } = require('../../dashboard/spend-line.cjs');
const { cardLines, bulletList } = require('./support/lines.cjs');

function run({ root, since }) {
  const untagged = [];
  const zero = [];
  for (const { file, line } of cardLines(root)) {
    const t = toEnglish(line.trim());
    const m = SPEND_TOKENS_OR_UNKNOWN_RE.exec(t);
    if (!m || m[2] < since) continue;
    if (!ENGINE_TAG_RE.test(t)) untagged.push(`${file}: ${m[1]} ${m[2]}`);
    if (m[3] !== 'unknown' && Number(m[3].replace(/[\s  ]/g, '')) === 0) zero.push(`${file}: ${m[1]} ${m[2]}`);
  }
  const problems = [];
  if (untagged.length) {
    problems.push(`нет метки движка в ${untagged.length} строках захода с ${since} ` +
      `(§3: описание после тире начинается с claude-code: / codex: / gemini:):\n      ` + bulletList(untagged));
  }
  if (zero.length) {
    problems.push(`\`0 tokens\` числом в ${zero.length} строках захода с ${since} ` +
      `(ECONOMY.md, «\`Intent\` in the shared session»: расход — из журнала сессии, card-session-spend.cjs; не найден — ` +
      `\`unknown tokens (cache-read unknown)\` с причиной; событие без работы — без \`attempt\`):\n      ` + bulletList(zero));
  }
  return problems;
}

module.exports = { id: 'engine-tag', since: 'engine-tag', run };
