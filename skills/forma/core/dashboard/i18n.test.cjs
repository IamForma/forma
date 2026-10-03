#!/usr/bin/env node
'use strict';
/**
 * Локализация дашборда: ядро перевода, список языков, словари en и ru.
 *   node .forma/dashboard/i18n.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const core = require('./web/js/i18n.js');
const i18n = require('./lib/i18n.cjs');

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };

it('подстановки {имя}; неизвестная подстановка остаётся как есть', () => {
  assert.equal(core.translate({ en: { k: 'Hello, {name} {x}' } }, 'en', 'k', { name: 'Ann' }), 'Hello, Ann {x}');
});

it('нет ключа в языке — берётся en; нет нигде — сам ключ', () => {
  const d = { en: { a: 'A', b: 'B' }, ru: { a: 'А' } };
  assert.equal(core.translate(d, 'ru', 'a'), 'А');
  assert.equal(core.translate(d, 'ru', 'b'), 'B');
  assert.equal(core.translate(d, 'ru', 'zzz'), 'zzz');
  assert.equal(core.translate(d, 'de', 'a'), 'A');
});

it('формы числа: en one/other, ru one/few/many', () => {
  const d = {
    en: { c: { one: '{n} card', other: '{n} cards' } },
    ru: { c: { one: '{n} карточка', few: '{n} карточки', many: '{n} карточек', other: '{n} карточки' } },
  };
  assert.deepEqual([1, 2, 5].map((n) => core.translate(d, 'en', 'c', { n })), ['1 card', '2 cards', '5 cards']);
  assert.deepEqual([1, 2, 5, 21].map((n) => core.translate(d, 'ru', 'c', { n })), ['1 карточка', '2 карточки', '5 карточек', '21 карточка']);
});

it('список языков: en первым, названия из _meta.name, лишние файлы пропускаются', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-locales-'));
  fs.writeFileSync(path.join(dir, 'ru.json'), '{"_meta.name":"Русский"}');
  fs.writeFileSync(path.join(dir, 'en.json'), '{"_meta.name":"English"}');
  fs.writeFileSync(path.join(dir, 'de.json'), '{}');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
  assert.deepEqual(i18n.listLocales(dir), [{ code: 'en', name: 'English' }, { code: 'de', name: 'de' }, { code: 'ru', name: 'Русский' }]);
});

it('словари дашборда: en и ru есть, ключи совпадают', () => {
  const codes = i18n.listLocales().map((l) => l.code);
  assert.ok(codes.includes('en') && codes.includes('ru'));
  assert.deepEqual(Object.keys(i18n.readDict('ru')).sort(), Object.keys(i18n.readDict('en')).sort());
});

it('серверный tr: язык и запасной en', () => {
  assert.equal(i18n.tr('ru', 'tab.economy'), 'Экономика');
  assert.equal(i18n.tr('en', 'tab.economy'), 'Economy');
  assert.equal(i18n.tr('xx', 'tab.economy'), 'Economy');
});

// Браузерная часть: файл исполняется в песочнице с подставными window, document, fetch и localStorage.
function browser(store = {}) {
  const events = [];
  const win = {};
  const document = { documentElement: {}, title: '', querySelectorAll: () => [], getElementById: () => null, dispatchEvent: (e) => events.push(e.detail) };
  const ctx = {
    window: win, globalThis: win, document, Intl,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    fetch: (url) => {
      if (url === 'locales.json') return Promise.resolve({ ok: true, json: () => Promise.resolve({ locales: i18n.listLocales() }) });
      const f = path.join(__dirname, url);
      return Promise.resolve(fs.existsSync(f) ? { ok: true, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, 'utf8'))) } : { ok: false });
    },
  };
  require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname, 'web/js/i18n.js'), 'utf8'), ctx);
  return { win, store, events };
}

(async () => {
  let b = browser();
  await b.win.i18nInit();
  assert.equal(b.win.i18nLang(), 'en');
  assert.equal(b.win.t('tab.economy'), 'Economy');
  await b.win.i18nSet('ru');
  assert.equal(b.win.t('tab.economy'), 'Экономика');
  assert.equal(b.store['forma.lang'], 'ru');
  assert.deepEqual(b.events, ['en', 'ru']);
  passed += 1; console.log('ok  браузер: по умолчанию en, переключение на ru, выбор запоминается, событие i18n');

  b = browser({ 'forma.lang': 'ru' });
  await b.win.i18nInit();
  assert.equal(b.win.t('tab.board'), 'Канбан');
  b = browser({ 'forma.lang': 'xx' });
  await b.win.i18nInit();
  assert.equal(b.win.i18nLang(), 'en');
  passed += 1; console.log('ok  браузер: сохранённый язык применяется; неизвестный код — en');

  console.log(`\n${passed} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
