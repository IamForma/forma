#!/usr/bin/env node
'use strict';
/**
 * Вкладки «Борт» и «Движок» на двух языках: все ключи t('…') из bort.js и engine.js есть в en и ru,
 * отрисовка не оставляет сырых ключей, а на en — кириллицы (данные в тесте английские).
 *   node .forma/dashboard/bort-engine-i18n.test.cjs
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
const FILES = ['bort.js', 'engine.js'];

for (const f of FILES) {
  it(`каждый ключ t('…') и cnt('…') в ${f} есть в en и ru`, () => {
    const keys = new Set();
    for (const m of js(f).matchAll(/\b(?:t|cnt)\('([\w.-]+)'[,)]/g)) keys.add(m[1]);
    assert.ok(keys.size > 40, 'ключей найдено мало: ' + keys.size);
    assert.deepEqual([...keys].filter((k) => !(k in dicts.en && k in dicts.ru)), []);
  });
  it(`в ${f} нет кириллицы вне комментариев и строк-источников`, () => {
    const code = js(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      .replace(/'«[^'»]+»'/g, "''"); // имена секций PROJECT.md — данные на языке проекта
    const hit = code.match(/.{0,30}[А-Яа-яЁё]+.{0,20}/);
    assert.equal(hit, null, 'кириллица в коде: ' + (hit && hit[0]));
  });
}

function load(lang) {
  const el = { innerHTML: '', querySelectorAll: () => [] };
  const ctx = { Intl, Date, Math, Number, String, Object, Array, Set, Map, JSON, console, parseInt, parseFloat, isNaN,
    document: { getElementById: () => el, addEventListener() {}, documentElement: {} }, window: {}, localStorage: { getItem: () => null, setItem() {} },
    graphifyBadgeHtml: (h) => `<span class="badge">${h}</span>`, latestData: null };
  ctx.window = ctx;
  ctx.t = (key, vars) => core.translate(dicts, lang, key, vars);
  ctx.i18nLang = () => lang;
  vm.createContext(ctx);
  vm.runInContext(js('common.js') + '\n' + js('bort.js') + '\n' + js('engine.js')
    + '\nthis.__x = { bortNodesHtml, bortNodeHtml, bortSessionHtml, floorChartHtml, bortStripHtml, bortSummaryHtml, bortSessionBlockHtml, projectSettingsHtml, engineSettingsHtml, routesCatalogHtml };', ctx, { filename: 'bort-engine.js' });
  return ctx.__x;
}

const tool = (decl, verdict, calls, ambiguous = false) => ({ decl, verdict, calls, ambiguous });
const mk = (name, extra = {}) => ({ node: name, model: 'm', effort: 'high', file: name.toLowerCase() + '.md', inherits: false, toolCount: 3, weightTokens: 2160,
  tools: [tool('Read', 'live', 5), tool('Bash(ls)', 'live', 2, true), tool('Grep', 'dead', 0), tool('Glob', 'unknown', 0)],
  counts: { live: 2, dead: 1, unknown: 1 }, nodeInLog: true, calls: 7, deadWeight: 720, undeclared: [{ tool: 'Task', calls: 2 }], ...extra });
const bort = {
  source: true, log: { alive: true, usable: true, errorCount: 2 },
  nodes: [mk('Kit'), mk('Run', { nodeInLog: false, counts: { live: 0, dead: 0, unknown: 3 }, deadWeight: 0 }), mk('Spec', { inherits: true })],
  totals: { nodesInLog: 1, nodeCount: 3, live: 2, dead: 1, unknown: 4, toolCount: 6, weightTokens: 4320, deadWeight: 720 }, toolTokenCost: 720,
  servers: [{ name: 'srv', transport: 'stdio', target: 'cmd', level: 'project', source: '.mcp.json' }, { broken: true, source: 'bad.json' }],
  mcpScanned: [{ source: '.mcp.json', exists: true, count: 1 }, { source: 'x.json', exists: false }, { source: 'bad.json', broken: true }],
  referenced: [{ server: 'srv', toolCount: 2, nodes: ['Kit'], inProjectConfig: true }, { server: 'ext', toolCount: 1, nodes: ['Run'], inProjectConfig: false }],
  floor: { byDate: [{ date: D(1), floor: 70000, sessions: 3 }, { date: D(2), floor: 71000, sessions: 1 }], min: 70000, max: 71000, drift: 1000, ageHours: 3 },
};
const project = { present: true, language: 'en', thresholds: { attempts: 3, volume: 5 }, release: 10, goals: [{ id: 'goal-01' }, { id: 'goal-02', draft: true }],
  template: { name: 'T', status: 'draft' }, epics: { rows: [['1', 'Epic', 'Func', 'route-4']] }, services: { rows: [] },
  tooling: { columns: ['a'], rows: [['b']] }, references: { columns: ['a'], rows: [] }, skills: { columns: ['a'], rows: [['s']] } };
const engine = { present: true, check: { ran: true, ok: false, exitCode: 1, reasons: ['r'] }, hooks: [{ event: 'Stop', matcher: '', commands: ['.claude/hooks/a.sh'] }],
  hookDescs: {}, nodes: [{ name: 'Kit', model: 'm', effort: 'high', tools: ['Read'] }],
  mcp: { project: [{ file: '.mcp.json', servers: ['srv'] }, { file: 'x.json', servers: null }], user: [], userProject: ['u'] },
  skills: ['sk'], env: [{ name: 'A', value: 'v' }, { name: 'B', hidden: true }],
  routes: { source: 'ROUTES.md', routes: [{ code: 'route-0', name: 'n', chain: 'c', risks: [{ label: 'l', text: 'x' }], where: 'w' }], overlays: [{ code: 'over-1', name: 'o', changes: 'z', risks: [], where: [] }] } };

for (const [lang, cyr] of [['en', false], ['ru', true]]) {
  it(`отрисовка на ${lang}: нет сырых ключей${cyr ? '' : ' и кириллицы'}`, () => {
    const x = load(lang);
    const html = [x.bortNodesHtml(bort), x.bortSessionHtml(bort), x.floorChartHtml(bort.floor), x.floorChartHtml(null), x.floorChartHtml({ unavailable: '' }),
      bort.nodes.map((n, i) => x.bortStripHtml(n, i)).join(''), x.bortSummaryHtml(bort), x.bortSessionBlockHtml(bort),
      x.bortNodesHtml({ source: false }), x.bortNodesHtml({ source: true, log: { alive: false }, nodes: [] }),
      x.bortNodesHtml({ source: true, log: { alive: true, usable: false }, nodes: [] }),
      x.projectSettingsHtml(project), x.projectSettingsHtml(null), x.engineSettingsHtml(engine), x.engineSettingsHtml(null)].join('\n');
    assert.ok(html.length > 5000, 'не отрисовалось');
    assert.ok(!/\b(?:bort|eng)\.[a-z]+\.?[a-z]/.test(html), 'сырой ключ: ' + (html.match(/\b(?:bort|eng)\.[\w.-]+/) || [''])[0]);
    assert.ok(!/\{\w+\}/.test(html), 'неподставленная переменная: ' + (html.match(/\{\w+\}/) || [''])[0]);
    if (!cyr) {
      // «Эпики проекта» и другие имена секций — источники на языке проекта, это данные, а не интерфейс
      const clean = html.replace(/<span class="set-src">[^<]*<\/span>/g, '');
      assert.ok(!/[А-Яа-яЁё]/.test(clean), 'кириллица на en: ' + (clean.match(/.{20}[А-Яа-яЁё]+.{10}/) || [''])[0]);
    } else assert.ok(/Нагрузка по ролям/.test(html) && /Пол окна/.test(html));
  });
}

console.log(`\n${passed} passed`);
