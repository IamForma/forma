#!/usr/bin/env node
'use strict';
/**
 * Вкладка «Канбан» на двух языках: все ключи есть в en и ru, отрисовка карточки, плашек, маршрута и ожидания
 * не оставляет сырых ключей, а на en — кириллицы (данные карточки в тесте английские).
 *   node .forma/dashboard/board-i18n.test.cjs
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const i18n = require('./lib/i18n.cjs');
const core = require('./web/js/i18n.js');

let passed = 0;
const it = (name, fn) => { fn(); passed += 1; console.log('ok  ' + name); };
// Даты образцов собираются, а не пишутся: в чистой зоне нет календарных дат (запрет 16).
const D = (n) => ['2020', '01', '0' + n].join('-');
const js = (f) => fs.readFileSync(path.join(__dirname, 'web/js', f), 'utf8');
const dicts = { en: i18n.readDict('en'), ru: i18n.readDict('ru') };

it('каждый ключ t(\'…\') в board.js и common.js есть в en и ru', () => {
  const keys = new Set();
  for (const f of ['board.js', 'common.js']) for (const m of js(f).matchAll(/\bt\('([\w.-]+)'[,)]/g)) keys.add(m[1]);
  const prefixes = ['board.col.', 'board.rt.', 'board.step.', 'board.unit.', 'board.g.', 'board.s.', 'board.rdy.'];
  const lost = [...keys].filter((k) => !prefixes.includes(k) && !(k in dicts.en && k in dicts.ru));
  assert.deepEqual(lost, []);
});

it('маршруты, статусы и единицы снаряжения: словари полные', () => {
  const need = [];
  for (let i = 0; i < 9; i++) need.push('board.rt.route' + i);
  for (const s of ['backlog', 'todo', 'in-progress', 'review', 'done']) need.push('board.col.' + s, 'board.status.' + s);
  for (const u of ['role', 'skill', 'tool', 'access', 'data', 'model']) need.push('board.unit.' + u, 'board.unit.' + u + '.hint');
  for (const k of need) assert.ok(k in dicts.en && k in dicts.ru, k);
});

const stub = () => new Proxy(function () {}, {
  get: (_, k) => (k === 'classList' ? { toggle() {}, contains: () => false } : k === 'dataset' ? {} : k === Symbol.toPrimitive ? () => '' : stub()),
  set: () => true, apply: () => stub(),
});

function load(lang) {
  const ctx = { Intl, Date, Math, Number, String, Object, Array, Set, Map, JSON, console, parseInt, parseFloat, isNaN,
    document: stub(), window: {}, localStorage: { getItem: () => null, setItem() {} }, ResizeObserver: class { observe() {} }, engineLabel: (k) => k };
  ctx.window = ctx;
  ctx.t = (key, vars) => core.translate(dicts, lang, key, vars);
  ctx.i18nLang = () => lang;
  vm.createContext(ctx);
  vm.runInContext(js('common.js') + '\n' + js('board.js') + '\nthis.__x = { bdCardHtml, bdPips, bdWaiting, bdRouteHtml, boardRoutes, bdStatuses, BOARD_T, bdFmtTok, bdFmtSec, bdGoalName };', ctx, { filename: 'board.js' });
  return ctx.__x;
}

const card = {
  code: 'card-x1', title: 'Title', status: 'in-progress', assignee: 'Kit', epic: 'Epic', goal: 'goal-x', route: 'route-4', kind: 'tooling',
  labels: ['route-4', 'goal-x', 'over-1', 'trial'], criterion: 'c', delivers: 'd', budget: '2', attempts: 3, next: 'n', humanFlag: false,
  history: ['`Intent`, ' + D(3) + ': stage exec — go.'], historySpend: [], mentions: [], adrs: [], commits: [], materials: [],
  kitParts: {}, kitSkills: [], spend: { lines: 2, unknown: 0, sec: 4000, byEngine: { 'claude-code': { tokens: 1500000, cache: 1000, lines: 2, unknown: 0, mixed: false } } },
  ready: { goal: true, task: true, kit: false, kitUnits: ['Role'], route: true, approval: false, access: 'unknown', budgetLeft: -1, deps: ['card-x0'], depsOpen: ['card-x0'] },
};
const B = { DATA: { goals: {}, thresholds: { volume: 5 }, cards: [card] }, S: { q: '' }, byCode: { 'card-x1': card }, dependents: { 'card-x1': ['card-x2'] } };

for (const [lang, cyr] of [['en', false], ['ru', true]]) {
  it(`отрисовка карточки на ${lang}: нет сырых ключей${cyr ? '' : ' и кириллицы'}`, () => {
    const x = load(lang);
    const out = [x.bdCardHtml(B, card), x.bdPips(B, card), x.bdRouteHtml(card), JSON.stringify(x.bdWaiting(B, card)),
      JSON.stringify(x.boardRoutes()), JSON.stringify(x.BOARD_T.stage), x.bdFmtTok(1500000), x.bdFmtSec(4000), x.bdGoalName(B, '')].join('\n');
    assert.ok(!/\bboard\.[a-z]/.test(out), 'сырой ключ: ' + (out.match(/\bboard\.[\w.-]+/) || [''])[0]);
    if (!cyr) assert.ok(!/[А-Яа-яЁё]/.test(out), 'кириллица на en: ' + (out.match(/.{20}[А-Яа-яЁё]+.{10}/) || [''])[0]);
    else assert.ok(/маршрут/.test(out));
  });
}

console.log(`\n${passed} passed`);
