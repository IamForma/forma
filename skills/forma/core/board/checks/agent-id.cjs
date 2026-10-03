'use strict';

// Опознаватель вызова в строке захода. Закон (AGENTS.md §3): id стоит последним в блоке расхода, вплотную перед тире —
//   `Узел`, ГГГГ-ММ-ДД: attempt, N tokens (R cache-read), T s, `<id вызова>` — что сделано.
// Он единственное поле, общее у карточки и у журнала инструментов: журнал знает id и не знает карточки,
// карточка знает задачу и не знает id.
//
// Граница по дате — строго ПОЗЖЕ дня вступления, а не «с этого дня»: строки, написанные в сам день введения поля,
// его ещё не несут, и заполнить их нечем — id не переживает возврата вызова. Проверка, красная с первого дня
// на неисправимом, перестаёт читаться (так вышло с R и T).

const { toEnglish, SPEND_TOKENS_RE, HAS_CALL_ID_RE } = require('../../dashboard/spend-line.cjs');
const { cardLines, bulletList } = require('./support/lines.cjs');

function run({ root, since }) {
  // Заявка на запись расхода — SPEND_TOKENS_RE. id — последнее поле блока расхода перед тире (HAS_CALL_ID_RE): сам
  // опознаватель либо маркер неизвестного (ECONOMY.md, «The `unknown` marker»): движок его не вернул, узел это назвал, и строка остаётся полной.
  const missing = [];
  for (const { file, line } of cardLines(root)) {
    const t = toEnglish(line.trim());
    const m = SPEND_TOKENS_RE.exec(t);
    if (!m || m[2] < since) continue;
    // Законный ноль: узел работал внутри общей сессии, отдельного вызова не было — значит и id взяться неоткуда.
    if (Number(m[3].replace(/[\s  ]/g, '')) === 0) continue;
    if (!HAS_CALL_ID_RE.test(t)) missing.push(`${file}: ${m[1]} ${m[2]}`);
  }
  if (!missing.length) return [];
  return [`нет опознавателя вызова в ${missing.length} строках захода с ${since} ` +
    `(формат §3: …, T s, \`<id>\` — что сделано; какое поле возврата несёт ` +
    `опознаватель — §8 файла движка):\n      ` + bulletList(missing)];
}

module.exports = { id: 'agent-id', since: 'agent-id', run };
