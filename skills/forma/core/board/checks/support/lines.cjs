'use strict';

// Общее для проверок доски: список находок одной строкой-блоком и построчное чтение карточек.

const fs = require('fs');
const path = require('path');
const { cardFiles } = require('../../../dashboard/lib/card.cjs');

const MAX_SHOWN = 6;

/** Первые шесть элементов, каждый с новой строки под отступом, и «… и ещё N» за ними. Проверка называет проблему, не заваливает вывод. */
function bulletList(items) {
  return items.slice(0, MAX_SHOWN).join('\n      ') +
    (items.length > MAX_SHOWN ? `\n      … и ещё ${items.length - MAX_SHOWN}` : '');
}

/** Строки всех карточек доски (живых и закрытых): `[{ file, line }]`, `file` — имя файла карточки. */
function cardLines(root) {
  const out = [];
  for (const file of cardFiles(root)) {
    const name = path.basename(file);
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) out.push({ file: name, line });
  }
  return out;
}

module.exports = { bulletList, cardLines };
