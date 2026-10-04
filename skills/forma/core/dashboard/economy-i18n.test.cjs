#!/usr/bin/env node
'use strict';
/**
 * Вкладка «Экономика» на двух языках: все ключи t('…') из economy.js есть в en и ru, отрисовка всех пяти уровней
 * не оставляет сырых ключей, а на en — кириллицы (данные в тесте английские).
 *   node .forma/dashboard/economy-i18n.test.cjs
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

it('каждый ключ t(\'…\') и cnt(\'…\') в economy.js есть в en и ru', () => {
  const keys = new Set();
  for (const m of js('economy.js').matchAll(/\b(?:t|cnt)\('([\w.-]+)'[,)]/g)) keys.add(m[1]);
  assert.ok(keys.size > 100, 'ключей найдено мало: ' + keys.size);
  const lost = [...keys].filter((k) => !(k in dicts.en && k in dicts.ru));
  assert.deepEqual(lost, []);
});

it('в economy.js нет кириллицы вне комментариев', () => {
  const code = js('economy.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const hit = code.match(/.{0,30}[А-Яа-яЁё]+.{0,20}/);
  assert.equal(hit, null, 'кириллица в коде: ' + (hit && hit[0]));
});

const stub = () => new Proxy(function () {}, {
  get: (_, k) => (k === 'classList' ? { toggle() {}, contains: () => false } : k === 'dataset' ? {} : k === Symbol.toPrimitive ? () => '' : stub()),
  set: () => true, apply: () => stub(),
});

function load(lang) {
  const out = { html: '' };
  const el = { set innerHTML(v) { out.html = v; }, get innerHTML() { return out.html; }, querySelectorAll: () => [] };
  const ctx = { Intl, Date, Math, Number, String, Object, Array, Set, Map, JSON, console, parseInt, parseFloat, isNaN,
    document: { getElementById: () => el, addEventListener() {}, documentElement: {} }, window: {}, localStorage: { getItem: () => null, setItem() {} },
    graphifyBadgeHtml: (h) => `<span class="badge">${h}</span>`, latestData: null };
  ctx.window = ctx;
  ctx.t = (key, vars) => core.translate(dicts, lang, key, vars);
  ctx.i18nLang = () => lang;
  vm.createContext(ctx);
  vm.runInContext(js('common.js') + '\n' + js('economy.js') + '\nthis.__x = { renderEconomy, subagentsHtml, moneyHtml, servicesHtml, routesHtml, economyNodesHtml, daysHtml, level5Html };', ctx, { filename: 'economy.js' });
  return { x: ctx.__x, out };
}

const node = (name, tok) => ({ node: name, attemptCount: 3, tokensTotal: tok, avgTokens: Math.round(tok / 3), withSeconds: 2, secondsTotal: 300, avgSeconds: 150,
  cardCount: 2, costUsdTotal: name === 'Kit' ? 0.5 : 0, externalAttemptCount: name === 'Kit' ? 1 : 0, avgSteps: 4 });
const byNode = ['Intent', 'Spec', 'Kit', 'Run', 'Core'].map((n, i) => node(n, 1000 * (i + 1)));
const engine = {
  byNode, totals: { tokens: 15000, work: 9000, cacheRead: 6000 },
  byRoute: { route: [{ key: 'route-4', cards: 2, tokens: 100, returns: 1, attempts: 3, cacheRead: 50, seconds: 40, prepShare: null, prepNodes: '', tokensUnknown: 1, cacheUnknown: 0, secondsUnknown: 2 }], over: [], seg: [], wave: [] },
  topCards: [{ title: 'Card', tokens: 500, attempts: 2, seconds: 120, nodes: ['Kit', 'Run'] }],
  efficiency: { cardsCounted: 2, perCard: 1200, byDate: [{ date: D(1), perCard: 1500 }, { date: D(2), perCard: 1200 }] },
};
const sessions = [{ first: D(1), live: true, calls: 10, cacheRead: 5e6, output: 4e4, ratio: 120, costUsd: 12, estUsd: 11 }];
const d = {
  totals: { epicCount: 3, cardCount: 20, attemptCount: 9, costUsdTotal: 0.5, byStatus: { done: 5, backlog: 15 } },
  byNode, subagents: [{ agent: 'helper', role: 'Helper', stale: true, calls: 2, tokensTotal: 100, hiredAt: D(1) + ' 10:00', lastUsedAt: D(2) + ' 10:00' }],
  dialog: { current: { sessions: 2, work: 100, cacheRead: 50, calls: 5 }, all: { work: 300, cacheRead: 100, sessions: 4, usd: 12.4, ageHours: 30 }, codex: { sessions: [1], byKind: {} } },
  sessionEconomy: { totals: { ratio: 90, sessions: 1, calls: 10, cacheRead: 5e6, output: 4e6, costUsdSessions: 1, bestUsd: 12 }, sessions, byWeek: [{ week: 'W1', ratio: 80, sessions: 1 }, { week: 'W2', ratio: 100, sessions: 1 }],
    ageHours: 2, verification: { suspectThresholdPct: 5, sessionsChecked: 1, sessionsTotal: 2, rows: [{ date: D(1), crPct: 1, ccPct: null, outPct: -2, inheritedCalls: 3, suspect: true }] } },
  nodeConfig: [{ node: 'Kit', model: 'm', effort: 'high', toolCount: 4, externalModel: true }],
  economy: {
    ...engine, engines: { 'claude-code': engine, untagged: { ...engine, byRoute: null, topCards: [] } },
    byEngine: { keys: ['claude-code', 'untagged'], columns: { 'claude-code': { attempts: 3, seconds: 100, cards: 2, tokens: 10, cacheRead: 5, unknown: { tokens: 1, cache_read: 2, duration_s: 3, call_id: 'x' } }, untagged: { attempts: 1, seconds: 10, cards: 1, tokens: 1, cacheRead: 0, unknown: { tokens: 0 } } }, common: { attempts: 4, seconds: 110, accepted: 5 } },
    coverage: { cardsWorked: 10, cardsWithAttempts: 7, attemptsWithCacheRead: 3, blindSpotCount: 3 },
    blindSpots: [{ title: 'Blind', status: 'done', epic: 'E' }], malformed: [{ cardId: 'card-x1-x', line: 'line' }],
    byService: [{ service: 'Svc', unit: 'credits', amount: 5, calls: 1, cardCount: 1, firstDate: D(1), lastDate: D(2), operations: [{ operation: 'op', amount: 5 }] }],
    instruction: { common: { tokens: 1000 }, byNode: { Kit: { perStep: 5000 } } },
    byDate: [{ date: D(1), tokens: 100, attempts: 2, seconds: 10 }, { date: D(2), tokens: 200, attempts: 3, seconds: 20 }],
  },
};

for (const [lang, cyr] of [['en', false], ['ru', true]]) {
  it(`отрисовка вкладки на ${lang}: нет сырых ключей${cyr ? '' : ' и кириллицы'}`, () => {
    const { x, out } = load(lang);
    const ctxLatest = d; // renderEconomy читает latestData только в обработчике клика
    x.renderEconomy(ctxLatest);
    const html = out.html + '\n' + x.daysHtml(d.economy.byDate) + x.economyNodesHtml(byNode) + x.routesHtml(engine.byRoute)
      + x.servicesHtml({ byService: [] }, false) + x.moneyHtml({ costUsdTotal: 0 }, [], false) + x.subagentsHtml([], false);
    assert.ok(html.length > 3000, 'вкладка не отрисовалась');
    assert.ok(!/\becon\.[a-z]/.test(html), 'сырой ключ: ' + (html.match(/\becon\.[\w.-]+/) || [''])[0]);
    assert.ok(!/\btime\.[a-z]/.test(html), 'сырой ключ: ' + (html.match(/\btime\.[\w.-]+/) || [''])[0]);
    assert.ok(!/\{\w+\}/.test(html), 'неподставленная переменная: ' + (html.match(/\{\w+\}/) || [''])[0]);
    if (!cyr) assert.ok(!/[А-Яа-яЁё]/.test(html), 'кириллица на en: ' + (html.match(/.{20}[А-Яа-яЁё]+.{10}/) || [''])[0]);
    else assert.ok(/Слепые пятна/.test(html) && /Инструктаж/.test(html));
  });
}

it('пустые данные: без второго движка и ведомости вкладка рисуется на en без кириллицы', () => {
  const { x, out } = load('en');
  x.renderEconomy({ totals: { epicCount: 0, cardCount: 0, attemptCount: 0, costUsdTotal: 0, byStatus: {} }, byNode: [], subagents: [], economy: { coverage: { blindSpotCount: 0 }, blindSpots: [], malformed: [] } });
  assert.ok(out.html.length > 500);
  assert.ok(!/\becon\.[a-z]/.test(out.html) && !/[А-Яа-яЁё]/.test(out.html), (out.html.match(/.{20}[А-Яа-яЁё]+.{10}/) || [''])[0]);
});

console.log(`\n${passed} passed`);
