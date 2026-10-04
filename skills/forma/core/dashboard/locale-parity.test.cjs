#!/usr/bin/env node
'use strict';
/**
 * Проверка locale-parity: краснеет на образцах порчи (лишний ключ, пропущенный перевод, неиспользуемый ключ,
 * ключ из кода без словаря, кириллица в web/js и index.html), зелёная на чистом коде; сборка дашборда на en и ru.
 *   node .forma/dashboard/locale-parity.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const check = require('./checks/locale-parity.cjs');
const i18n = require('./lib/i18n.cjs');

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

// Образец: крошечный «дашборд» во временном корне.
function sample(mutate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'locale-parity-'));
  const d = path.join(root, '.forma/dashboard');
  fs.mkdirSync(path.join(d, 'locales'), { recursive: true });
  fs.mkdirSync(path.join(d, 'web/js'), { recursive: true });
  fs.mkdirSync(path.join(d, 'web/css'), { recursive: true });
  const w = (rel, text) => fs.writeFileSync(path.join(d, rel), text);
  w('locales/en.json', JSON.stringify({ '_meta.name': 'English', 'a.title': 'A', 'a.kind.x': 'X' }));
  w('locales/ru.json', JSON.stringify({ '_meta.name': 'Русский', 'a.title': 'А', 'a.kind.x': 'Икс' }));
  w('web/js/a.js', "// комментарий по-русски — можно\nconst a = t('a.title'); const b = t('a.kind.' + k);\n");
  w('web/css/base.css', '.x::before{content:"▶"}\n');
  w('index.html', '<html lang="en"><!-- можно --><h1 data-i18n="a.title"></h1></html>\n');
  if (mutate) mutate(w, d);
  return { root, run: () => check.run({ root }) };
}
const has = (problems, re) => assert.ok(problems.some((p) => re.test(p)), 'нет находки ' + re + ' в ' + JSON.stringify(problems));

it('чистый образец — находок нет', () => assert.deepEqual(sample().run(), []));
it('пропущенный перевод (ключ только в en)', () => has(sample((w) => w('locales/en.json', JSON.stringify({ '_meta.name': 'E', 'a.title': 'A', 'a.kind.x': 'X', 'a.more': 'M' }))).run(), /ключа «a\.more» нет в ru\.json/));
it('лишний ключ только в ru', () => has(sample((w) => w('locales/ru.json', JSON.stringify({ '_meta.name': 'Р', 'a.title': 'А', 'a.kind.x': 'И', 'a.extra': 'Э' }))).run(), /ключа «a\.extra» нет в en\.json/));
it('неиспользуемый ключ', () => {
  const both = (w) => { for (const l of ['en', 'ru']) w(`locales/${l}.json`, JSON.stringify({ '_meta.name': l, 'a.title': 'A', 'a.kind.x': 'X', 'z.dead': 'D' })); };
  has(sample(both).run(), /«z\.dead» нигде не используется/);
});
it('ключ из кода без словаря', () => has(sample((w) => w('web/js/a.js', "const a = t('a.title'); const c = t('a.missing');\n")).run(), /ключ «a\.missing» из кода/));
it('ключ из разметки без словаря', () => has(sample((w) => w('index.html', '<html lang="en"><h1 data-i18n="a.title"></h1><p data-i18n="a.nope"></p></html>')).run(), /ключ «a\.nope» из разметки/));
it('кириллица в web/js', () => has(sample((w) => w('web/js/a.js', "const a = t('a.title'); const b = t('a.kind.' + k); const s = 'Привет';\n")).run(), /a\.js: кириллица вне словарей/));
it('кириллица в index.html', () => has(sample((w) => w('index.html', '<html lang="en"><h1 data-i18n="a.title">Заголовок</h1></html>')).run(), /index\.html: кириллица/));
it('кириллица в css content', () => has(sample((w) => w('web/css/base.css', '.x::before{content:"▶ Здесь"}\n')).run(), /base\.css: кириллица в content/));
it('метка i18n-keep разрешает данные', () => assert.deepEqual(sample((w) => w('web/js/a.js', "const a = t('a.title'); const b = t('a.kind.' + k); const f = 'Роль'; // i18n-keep\n")).run(), []));
it('нет каталога locales — проверка молчит', () => assert.deepEqual(check.run({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'lp-')) }), []));
it('настоящий дашборд чист', () => assert.deepEqual(check.run({ root: path.join(__dirname, '../..') }), []));
it('сборка словарей: en и ru читаются, ключей поровну', () => {
  const en = i18n.readDict('en'), ru = i18n.readDict('ru');
  assert.equal(Object.keys(en).length, Object.keys(ru).length);
  assert.deepEqual(i18n.listLocales().map((l) => l.code).sort(), ['en', 'ru']);
});
console.log(`\n${passed} passed`);
