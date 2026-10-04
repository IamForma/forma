#!/usr/bin/env node
'use strict';
/**
 * Серверные строки интерфейса: английский запас/код вместо русского текста, ключи есть в en и ru.
 *   node .forma/dashboard/server-i18n.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const i18n = require('./lib/i18n.cjs');
const chain = require('./data/chain.cjs');

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };
const rd = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const en = i18n.readDict('en'), ru = i18n.readDict('ru');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/[ \t]\/\/ .*$/gm, '');

it('ключи chain.step.*, chain.v.*, st.g/st.k, docs.title.*, fm.runNote.* есть в en и ru', () => {
  const pre = /^(chain\.step\.|chain\.v\.|st\.[gk]\.|docs\.title\.|fm\.runNote\.|bort\.fl\.u\.)/;
  const keys = Object.keys(en).filter((k) => pre.test(k));
  assert.ok(keys.length >= 30);
  assert.deepEqual(keys.filter((k) => !(k in ru)), []);
});
it('каждый вид нарушения цепи имеет перевод', () => {
  for (const k of ['cards-without-image', 'epic-name-drift', 'no-goal-md', 'epic-without-goal', 'image-without-interview'])
    assert.ok(('chain.v.' + k) in en && ('chain.v.' + k) in ru, k);
});
it('серверные модули без кириллицы в строках (кроме описаний файлов структуры)', () => {
  for (const f of ['data/chain.cjs', 'data/cards.cjs', 'data/bort.cjs', 'data/docs.cjs', 'lib/forma-roles.cjs']) {
    const hit = strip(rd(f)).match(/.{0,30}[А-Яа-яЁё]+.{0,20}/);
    assert.equal(hit, null, f + ': ' + (hit && hit[0]));
  }
  const sv = strip(rd('serve.js')).split('\n').filter((l) => /error:|failMessage/.test(l) && /[А-Яа-яЁё]/.test(l));
  assert.deepEqual(sv, []);
});
it('шаги цепи отдаются с английскими именами', () => {
  const s = chain.SETUP_STEPS || [];
  if (s.length) assert.ok(s.every((x) => !/[А-Яа-яЁё]/.test(x.name)));
});
console.log(`\n${passed} passed`);
