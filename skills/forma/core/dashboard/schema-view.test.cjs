#!/usr/bin/env node
'use strict';
// Вкладка «Схема»: данные для отрисовки берутся из schema.cjs, счётчики сходятся с составом, вёрстка без списков.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const { buildSchemaView, TYPES } = require('./schema-view.cjs');
const root = path.resolve(__dirname, '..', '..');
const s = buildSchemaView(root);

test('counts by type add up to block file count', () => {
  for (const b of s.blocks) assert.equal(TYPES.reduce((n, k) => n + b.counts[k], 0), b.files.length, b.key);
});
test('every file carries one known type', () => {
  for (const f of s.files) assert.ok(TYPES.includes(f.type), f.path);
});
test('generate.js exposes the schema', () => {
  assert.ok(require('./generate.js').buildData(root).schema.blocks.length > 0);
});
test('markup has no hand-written file lists', () => {
  const js = fs.readFileSync(path.join(__dirname, 'web/js/schema.js'), 'utf8');
  assert.ok(!/\.(cjs|sh|md)['"]/.test(js));
});
test('arrows: five link types, data-driven, no hand-drawn links', () => {
  assert.deepEqual(s.linkTypes.map((k) => k.key), ['reads', 'writes', 'calls', 'registers', 'spawns']);
  const js = fs.readFileSync(path.join(__dirname, 'web/js/schema.js'), 'utf8');
  assert.ok(js.includes('blockLinks') && !/from:\s*['"]/.test(js));
  const css = fs.readFileSync(path.join(__dirname, 'web/css/base.css'), 'utf8');
  for (const k of s.linkTypes) { assert.ok(css.includes('--lk-' + k.key + ':'), k.key); assert.ok(css.includes('.sc-l-' + k.key + '{'), k.key); }
  assert.ok(s.blockLinks.some((l) => l.from !== l.to), 'cross-block links exist');
});
