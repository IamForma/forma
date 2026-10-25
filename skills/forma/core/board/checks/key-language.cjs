'use strict';

// Ключи карточки — только по-английски, при любом языке проекта (AGENTS.md §6): заголовки зон, вид, ключи «Снаряжения»,
// глаголы истории. Тексты (значения, описания) остаются на языке проекта. Нарушение — карточка, которую
// `migrate-keys.cjs` изменил бы: адрес — файл, ожидаемое значение — английский ключ.

const fs = require('fs');
const path = require('path');
const { cardFiles } = require('../../dashboard/lib/card.cjs');
const { migrate } = require('../migrate-keys.cjs');
const { bulletList } = require('./support/lines.cjs');

function run({ root }) {
  const bad = [];
  for (const file of cardFiles(root, /^card-\d+.*\.md$/)) {
    const text = fs.readFileSync(file, 'utf8');
    const r = migrate(text);
    if (!r.changed) continue;
    const c = r.counts;
    const was = text.split('\n'), now = r.text.split('\n');
    const i = was.findIndex((l, k) => l !== now[k]);
    bad.push(`${path.basename(file)}:${i + 1}: «${was[i].trim().slice(0, 50)}» → «${now[i].trim().slice(0, 50)}» (заголовки ${c.headings}, вид ${c.kind}, снаряжение ${c.kit}, история ${c.verbs})`);
  }
  if (!bad.length) return [];
  return [`ключи карточки не по-английски у ${bad.length} карточек (§6; исправить: node .forma/board/migrate-keys.cjs --apply):\n      ` + bulletList(bad)];
}

module.exports = { id: 'key-language', since: null, run };
