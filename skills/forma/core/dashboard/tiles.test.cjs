#!/usr/bin/env node
'use strict';
/**
 * Плитки движков в сводке «Экономики»: место (цвет), шкала, нет данных — не ноль.
 *   node .forma/dashboard/tiles.test.cjs
 */
const assert = require('node:assert/strict');
const { tilePlace, tileFrac, tileModel } = require('./web/js/economy.js');

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };
const m = (v) => ({ v, n: v == null ? 0 : 9, m: 9, low: false });
const eng = (out, sec, tok, usd, retry, closed = 3) => ({ outPerCallSec: m(out), secPerClosed: m(sec), tokensPerClosed: m(tok),
  usdPerClosed: m(usd), retryShare: m(retry), tokensTotal: m(null), secTotal: m(null), usdTotal: m(null), closedCards: closed });

it('место: больше — лучше для скорости, меньше — лучше для цены; один движок и равные — нейтрально', () => {
  assert.equal(tilePlace([10, 5, 1], 10, true), 'good');
  assert.equal(tilePlace([10, 5, 1], 5, true), 'mid');
  assert.equal(tilePlace([10, 5, 1], 1, true), 'bad');
  assert.equal(tilePlace([10, 5, 1], 1, false), 'good');
  assert.equal(tilePlace([10, 5, 1], 10, false), 'bad');
  assert.equal(tilePlace([7], 7, true), 'neutral');
  assert.equal(tilePlace([7, 7], 7, true), 'neutral');
  assert.equal(tilePlace([7, null], 7, true), 'neutral');
  assert.equal(tilePlace([7, 3], null, true), null);
});

it('шкала: максимум среди движков — полная дуга; нет значения — null, не ноль', () => {
  assert.equal(tileFrac([40, 20, null], 40), 1);
  assert.equal(tileFrac([40, 20, null], 20), 0.5);
  assert.equal(tileFrac([40, 20, null], null), null);
  assert.equal(tileFrac([0, 0], 0), 0);
  assert.equal(tileFrac([1000, 1], 1), 0.04);
});

it('модель: плиток столько, сколько движков; места по колонкам; пустой движок помечен empty', () => {
  const sm = { tags: ['a', 'b', 'c'], engines: { a: eng(40, 100, 5000, 0.1, 0.1), b: eng(20, 300, 9000, 0.4, 0.5), c: eng(null, null, null, null, null, 0) },
    total: eng(30, 200, 7000, 0.2, 0.3) };
  const mod = tileModel(sm);
  assert.equal(mod.tiles.length, 3);
  const [a, b, c] = mod.tiles;
  assert.deepEqual([a.out.place, b.out.place, a.out.frac, b.out.frac], ['good', 'bad', 1, 0.5]);
  assert.deepEqual([a.bars.sec.place, b.bars.sec.place, a.bars.tok.place, b.bars.usd.place], ['good', 'bad', 'good', 'bad']);
  assert.equal(a.bars.sec.frac, 100 / 300);
  assert.equal(a.retry.frac, 0.1);
  assert.deepEqual([a.empty, b.empty, c.empty], [false, false, true]);
  assert.equal(c.out.v, null);
  assert.equal(c.bars.usd.frac, null);
  assert.ok(mod.total);
});

it('один движок: дуга нейтральная и полная', () => {
  const t1 = tileModel({ tags: ['x'], engines: { x: eng(12, 10, 10, 1, 0) }, total: null }).tiles[0];
  assert.deepEqual([t1.out.place, t1.out.frac, t1.bars.tok.place], ['neutral', 1, 'neutral']);
});

console.log(`\n${passed} passed`);
