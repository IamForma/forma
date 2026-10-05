'use strict';

/**
 * Graphify — пять корпусов графов (project, manual, done-cards, site, engine), у каждого свой последний прогон,
 * стоимость и число узлов/рёбер/кластеров/предупреждений (не агрегат по всем сразу). Триггер по накоплению —
 * только у done-cards; project и manual получают «протухло» по хешу содержимого корпуса (`checkCorpusStale`);
 * site и engine строятся отдельными скриптами (`build-site-graph.cjs`, `build-engine-graph.cjs`) со своим
 * снимком каждый — без файлового протухания здесь.
 *
 * Журнал `.forma/dashboard/graphify.log` — не карточка, не круг: одна строка на запуск.
 * Формат базовый (все старые строки): ГГГГ-ММ-ДД ЧЧ:ММ | mode=... | agents=N | tokens=N | $X.XXXX | <что сделано>
 * Расширенный — между $-сегментом и свободной сводкой стоят необязательные поля key=value, в этом порядке:
 * corpus=<project|manual|done-cards|site|engine> | trigger=<manual|auto-accum|human> | nodes=N | edges=N | communities=N | warnings=N.
 * Каждое поле распознаётся независимо: старая строка без них разбирается так же, как раньше.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { walk, readJson } = require('../lib/fs.cjs');
const { cachePath } = require('./cache.cjs');

const GRAPHIFY_HEAD_RE =
  /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\|\s*mode=(\S+)\s*\|\s*agents=(\d+)\s*\|\s*tokens=(\d+)\s*\|\s*\$([\d.]+)\s*\|\s*(.*)$/;
const GRAPHIFY_EXTRA_KEY_RE = /^(corpus|trigger|nodes|edges|communities|warnings)=(.+)$/;

/** Корпуса графов — те же имена, что у вкладок. */
const GRAPHIFY_CORPORA = ['project', '.forma/manual', 'done-cards', 'site', 'engine'];

function parseGraphifyLine(trimmed) {
  const m = GRAPHIFY_HEAD_RE.exec(trimmed);
  if (!m) return null;
  const [, at, mode, agents, tokens, costUsd, rest] = m;
  const run = {
    at, mode,
    agents: parseInt(agents, 10),
    tokens: parseInt(tokens, 10),
    costUsd: parseFloat(costUsd),
    corpus: null, trigger: null, nodes: null, edges: null, communities: null, warnings: null,
    summary: rest,
  };
  const parts = rest.split(/\s*\|\s*/);
  let i = 0;
  while (i < parts.length) {
    const km = GRAPHIFY_EXTRA_KEY_RE.exec(parts[i]);
    if (!km) break;
    const [, key, val] = km;
    run[key] = /^\d+$/.test(val) ? parseInt(val, 10) : val;
    i += 1;
  }
  run.summary = parts.slice(i).join(' | ');
  return run;
}

function readRuns(file) {
  const runs = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const run = parseGraphifyLine(trimmed);
    if (run) runs.push(run);
  }
  return runs;
}

/**
 * Разбивка по корпусам. Строки без явного `corpus=` — записи до этой доработки; писал их один
 * `build-done-cards-graph.cjs`, поэтому по факту они относятся к done-cards.
 */
function byCorpusOf(runs) {
  const byCorpus = {};
  for (const r of runs) {
    const corpus = r.corpus || 'done-cards';
    if (!byCorpus[corpus]) byCorpus[corpus] = { corpus, runCount: 0, tokensTotal: 0, costUsdTotal: 0, lastRun: null };
    const c = byCorpus[corpus];
    c.runCount += 1;
    c.tokensTotal += r.tokens;
    c.costUsdTotal += r.costUsd;
    c.lastRun = r; // строки идут по порядку файла — последняя перезапись и есть последний запуск
  }
  for (const c of Object.values(byCorpus)) c.costUsdTotal = Number(c.costUsdTotal.toFixed(6));
  return byCorpus;
}

function readGraphifyLog(projectRoot) {
  const file = path.join(projectRoot, '.forma/dashboard', 'graphify.log');
  const emptyAggregate = { runCount: 0, lastRunAt: null, agentsTotal: 0, tokensTotal: 0, costUsdTotal: 0, recent: [], byCorpus: {} };
  if (!fs.existsSync(file)) return emptyAggregate;
  const runs = readRuns(file);
  if (!runs.length) return emptyAggregate;
  return {
    runCount: runs.length,
    lastRunAt: runs[runs.length - 1].at,
    agentsTotal: runs.reduce((s, r) => s + r.agents, 0),
    tokensTotal: runs.reduce((s, r) => s + r.tokens, 0),
    costUsdTotal: Number(runs.reduce((s, r) => s + r.costUsd, 0).toFixed(6)),
    recent: runs.slice(-5).reverse(),
    byCorpus: byCorpusOf(runs),
  };
}

// Метка от graphify-trigger.cjs — накопление событий перевалило за порог из graphify.config.json, граф
// просит пересборки. Только done-cards.
const readGraphifyPending = (projectRoot) => readJson(cachePath(projectRoot, 'graphify-pending.json'), null);

// Метка от build-done-cards-graph.cjs — потолок расхода (budget.maxUsdPerBuild) сработал посреди прогона,
// граф собран по неполному корпусу. Пишется/снимается тем же скриптом.
const readGraphifyBudgetStop = (projectRoot) => readJson(cachePath(projectRoot, 'graphify-budget-stop.json'), null);

// Каталог корпуса на диске для каждого имени вкладки (done-cards — не по этому механизму).
const CORPUS_SOURCE_DIR = { project: 'project', manual: '.forma/manual' };
// Служебные подкаталоги не считаем содержимым корпуса: они меняются от кэша и версий, не от правки содержимого.
const FINGERPRINT_SKIP_DIRS = new Set(['.cache', 'node_modules', '.git']);

function hashCorpus(dirAbs) {
  const skip = (e) => e.name.startsWith('.') || FINGERPRINT_SKIP_DIRS.has(e.name);
  const parts = walk(dirAbs, { symlinks: true, skip }).map((rel) => {
    const stat = fs.statSync(path.join(dirAbs, rel));
    return `${rel}:${stat.size}:${Math.round(stat.mtimeMs)}`;
  });
  parts.sort();
  return crypto.createHash('sha1').update(parts.join('\n')).digest('hex');
}

/**
 * Хеш содержимого корпуса (project/ или .forma/manual/) на момент последней сборки графа, сравнённый с текущим —
 * «протухло» без непрерывного счёта событий. Точка отсчёта — mtime .forma/living/graphs/<corpus>/graph.json:
 * когда он меняется (новая сборка /graphify), содержимое корпуса и хеш совпадают по определению, и тогда
 * снимок хеша перезаписывается заново. Пока graph.json не менялся — сверяем текущий хеш с сохранённым снимком.
 * Состояние — .forma/dashboard/.cache/corpus-fingerprint-<corpus>.json, читает и пишет только эта функция.
 */
function checkCorpusStale(projectRoot, corpus) {
  const dirName = CORPUS_SOURCE_DIR[corpus];
  if (!dirName) return null;
  const graphFile = path.join(projectRoot, '.forma/living', 'graphs', corpus, 'graph.json');
  if (!fs.existsSync(graphFile)) return null; // граф ещё ни разу не собирался

  const stateFile = cachePath(projectRoot, `corpus-fingerprint-${corpus}.json`);
  const graphMtime = fs.statSync(graphFile).mtimeMs;
  const state = readJson(stateFile, null);
  const currentHash = hashCorpus(path.join(projectRoot, dirName));

  if (!state || state.graphMtimeAtBuild !== graphMtime) {
    // graph.json новее прошлого снимка (или снимка ещё не было) — новая точка отсчёта.
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ graphMtimeAtBuild: graphMtime, hashAtBuild: currentHash }, null, 2), 'utf8');
    return false;
  }
  return state.hashAtBuild !== currentHash;
}

function corpusView(projectRoot, corpus, marks) {
  const fromLog = marks.log.byCorpus[corpus] || null;
  return {
    corpus,
    runCount: fromLog ? fromLog.runCount : 0,
    tokensTotal: fromLog ? fromLog.tokensTotal : 0,
    costUsdTotal: fromLog ? fromLog.costUsdTotal : 0,
    lastRun: fromLog ? fromLog.lastRun : null,
    stale: corpus === 'done-cards' ? null : checkCorpusStale(projectRoot, corpus),
    pending: corpus === 'done-cards' ? marks.pending : null,
    budgetStop: (marks.budgetStop && marks.budgetStop.corpus === corpus) ? marks.budgetStop : null,
  };
}

/** `{ graphify, graphifyPending, graphifyByCorpus }` — журнал запусков, метка накопления и три корпуса. */
function buildGraphify(projectRoot) {
  const log = readGraphifyLog(projectRoot);
  const pending = readGraphifyPending(projectRoot);
  const budgetStop = readGraphifyBudgetStop(projectRoot);
  const graphifyByCorpus = {};
  for (const corpus of GRAPHIFY_CORPORA) {
    graphifyByCorpus[corpus] = corpusView(projectRoot, corpus, { log, pending, budgetStop });
  }
  return { graphify: log, graphifyPending: pending, graphifyByCorpus };
}

/** Собран ли `graph.html` каждого корпуса: `{ manual, 'done-cards', project, site, engine }`. */
function graphsBuilt(projectRoot) {
  return Object.fromEntries(['.forma/manual', 'done-cards', 'project', 'site', 'engine'].map((c) => [c, fs.existsSync(path.join(projectRoot, '.forma/living', 'graphs', c, 'graph.html'))]));
}

module.exports = { buildGraphify, graphsBuilt };
