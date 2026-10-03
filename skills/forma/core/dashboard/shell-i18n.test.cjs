#!/usr/bin/env node
'use strict';
/**
 * Остальные вкладки и оболочка на двух языках: ключи t('…') есть в en и ru, в коде и в index.html нет русского текста,
 * простые вкладки рисуются на en без кириллицы и сырых ключей.
 *   node .forma/dashboard/shell-i18n.test.cjs
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
const rd = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const js = (f) => rd('web/js/' + f);
const dicts = { en: i18n.readDict('en'), ru: i18n.readDict('ru') };
const FILES = ['app.js', 'chain.js', 'docs.js', 'nodes.js', 'graphs.js', 'structure.js', 'forma.js', 'interview.js', 'law.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/[ \t]\/\/ .*$/gm, '');

for (const f of FILES) {
  it(`каждый ключ t('…') в ${f} есть в en и ru`, () => {
    const keys = new Set();
    for (const m of js(f).matchAll(/\bt\('([\w.-]+)'[,)]/g)) keys.add(m[1]);
    assert.ok(keys.size > 0, 'ключей нет');
    assert.deepEqual([...keys].filter((k) => !(k in dicts.en && k in dicts.ru)), []);
  });
  it(`в ${f} нет кириллицы вне комментариев`, () => {
    const hit = strip(js(f)).match(/.{0,30}[А-Яа-яЁё]+.{0,20}/);
    assert.equal(hit, null, 'кириллица в коде: ' + (hit && hit[0]));
  });
}

it('index.html и CSS без русского текста', () => {
  const html = rd('index.html').replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!/[А-Яа-яЁё]/.test(html), 'кириллица в index.html: ' + (html.match(/.{20}[А-Яа-яЁё]+.{10}/) || [''])[0]);
  assert.ok(/<html lang="en"/.test(html));
  for (const c of fs.readdirSync(path.join(__dirname, 'web/css'))) {
    const css = rd('web/css/' + c).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/content:\s*["'][^"']*[А-Яа-яЁё]/.test(css), 'кириллица в content: ' + c);
  }
});

function load(lang) {
  const el = { innerHTML: '', querySelectorAll: () => [], classList: { toggle() {} } };
  const ctx = { Intl, Date, Math, Number, String, Object, Array, Set, Map, JSON, console, parseInt, parseFloat, isNaN,
    document: { getElementById: () => el, addEventListener() {}, querySelector: () => el, querySelectorAll: () => [], documentElement: {} },
    window: {}, localStorage: { getItem: () => null, setItem() {} }, latestData: null };
  ctx.window = ctx;
  ctx.t = (key, vars) => core.translate(dicts, lang, key, vars);
  ctx.i18nLang = () => lang;
  vm.createContext(ctx);
  vm.runInContext(['common.js', 'graphs.js', 'nodes.js', 'chain.js', 'structure.js', 'docs.js'].map(js).join('\n')
    + '\nthis.__x = { nodesHtml, chainHtml, structureHtml, graphifyPanelHtml, docsHtml };', ctx, { filename: 'shell.js' });
  return ctx.__x;
}

const chain = { setup: [{ n: 1, name: 'Step', state: 'template', target: 'f.md' }], goals: [{ id: 'goal-01', roadmapName: null, draft: true, epic: '', cards: 2, cardsDone: 1 }, { id: 'goal-02', draft: false, epic: 'E', cards: 0 }],
  violations: [{ kind: 'no-goal-md', vars: { goal: 'goal-01' } }], summary: { goalsWithImage: 1, goalsTotal: 2, cardsUnderDraft: 2 } };
const structure = { groups: [], legend: [{ key: 'static', title: 'Static' }], settings: [{ rel: 'a.json', exists: false, who: 'human', note: 'n' }, { rel: 'b', exists: true, dir: true, files: 3, size: 2048, who: 'secret', note: 'n' }] };

for (const [lang, cyr] of [['en', false], ['ru', true]]) {
  it(`отрисовка простых вкладок на ${lang}: нет сырых ключей${cyr ? '' : ' и кириллицы'}`, () => {
    const x = load(lang);
    const full = { reason: '', corpus: 'project' };
    const html = [x.nodesHtml([{ node: 'Kit', model: '', effort: '', toolCount: 3, externalModel: true }]), x.nodesHtml([]), x.chainHtml(chain),
      x.graphifyPanelHtml('project', null), x.graphifyPanelHtml('done-cards', { stale: true, pending: { pending: true }, budgetStop: { filesProcessed: 1, filesTotal: 2, costUsd: 1, maxUsdPerBuild: 1 },
        lastRun: { nodes: 1, edges: 2, communities: 3, warnings: 0, at: D(1) + ' 10:00', trigger: 'x', costUsd: 0.1 } }),
      x.docsHtml(null)].join('\n');
    assert.ok(html.length > 2000, 'не отрисовалось');
    assert.ok(!/\b(?:chain|docs|nodes|gr|st|app)\.[a-z][\w.]*/.test(html.replace(/<code>[^<]*<\/code>|\/graphs\/[\w./-]+|\w+\.(?:md|js|cjs|json)/g, '')), 'сырой ключ: ' + (html.match(/\b(?:chain|docs|nodes|gr|st)\.[\w.]+/) || [''])[0]);
    assert.ok(!/\{\w+\}/.test(html), 'неподставленная переменная: ' + (html.match(/\{\w+\}/) || [''])[0]);
    if (!cyr) assert.ok(!/[А-Яа-яЁё]/.test(html), 'кириллица на en: ' + (html.match(/.{20}[А-Яа-яЁё]+.{10}/) || [''])[0]);
    else assert.ok(/Подготовка проекта/.test(html));
    void full; void structure;
  });
}

console.log(`\n${passed} passed`);
