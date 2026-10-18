'use strict';

// Полнота строки захода: кэш-чтение и время. Закон (AGENTS.md §3) требует записывать заход как
//   `Узел`, ГГГГ-ММ-ДД: attempt, N tokens (R cache-read), T s, `<id>` — что сделано.
// Кэш-чтение — постоянные накладные вызова, загрузка правил и роли; по нему и только по нему отличается «инструктаж»
// от «производства». Величины за прошлое не восстановить: метаданные вызовов не хранятся, поэтому проверяются только
// заходы с дня вступления правила и позже. Прошлое не переписывается (запрет 5): требовать поля от строк, которые
// нечем заполнить, — значит держать проверку вечно красной и приучить её не читать.

const fs = require('fs');
const path = require('path');
const { toEnglish, ATTEMPT_FORMAT_RE } = require('../../dashboard/spend-line.cjs');
const { cardFiles } = require('../../dashboard/lib/card.cjs');
const { bulletList } = require('./support/lines.cjs');

const CACHE_UNKNOWN_RE = /\(\s*cache-read unknown\s*\)/;

/** Строка файла, в которой стоит найденное совпадение, — целиком. */
function lineAt(body, idx) {
  const s = body.lastIndexOf('\n', idx) + 1;
  const e = body.indexOf('\n', idx);
  return body.slice(s, e === -1 ? body.length : e);
}

/**
 * Чего не хватает заходу: `['кэш-чтения', 'времени']` или пустой список. Законный ноль — узел работал внутри общей сессии,
 * отдельного вызова не было: «0 tokens, 0 s» полон сам по себе (§3; то же исключение — в проверке `agent-id`). Неизвестное,
 * записанное фактом (ECONOMY.md, «The `unknown` marker»): «(cache-read unknown)» на месте «(R cache-read)» — строка полна. Маркер ищется в самой
 * строке, а не группой разбора: скобка кэш-чтения в регулярке несёт неразрывные пробелы разрядов.
 */
function lacksOf(m, body) {
  if (Number(String(m[3]).replace(/[\s  ]/g, '')) === 0) return [];
  const lacks = [];
  if (!m[4] && !CACHE_UNKNOWN_RE.test(lineAt(body, m.index))) lacks.push('кэш-чтения');
  if (!m[5]) lacks.push('времени');
  return lacks;
}

function run({ root, since }) {
  const RE = ATTEMPT_FORMAT_RE;
  const missing = [];
  for (const file of cardFiles(root)) {
    const f = path.basename(file);
    const body = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(toEnglish).join('\n');
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(body)) !== null) {
      if (m[2] < since) continue;
      const lacks = lacksOf(m, body);
      if (lacks.length) missing.push(`${f}: ${m[1]} ${m[2]} — нет ${lacks.join(' и ')}`);
    }
  }
  if (!missing.length) return [];
  // Одной строкой со списком, а не строкой на каждый заход: проверка называет проблему, а не заваливает вывод.
  return [`строка захода неполна у ${missing.length} записей с ${since} ` +
    `(формат §3: N tokens (R cache-read), T s):\n      ` + bulletList(missing)];
}

module.exports = { id: 'attempt-format', since: 'attempt-format', run };
