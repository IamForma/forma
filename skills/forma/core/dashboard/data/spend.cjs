'use strict';

/**
 * Экономика и расход для дашборда: корпус целиком (поля без токенов) и разрезы по движкам.
 * Считает `spend-views.cjs`; здесь — вес инструктажа от адаптера и чтение `tally.cjs` (маршруты, движки).
 */

const fs = require('fs');
const path = require('path');
const { boardDir } = require('../lib/card.cjs');
const engines = require('../lib/engines.cjs');
const { spendViews } = require('./spend-views.cjs');

/**
 * Вес инструктажа от адаптера. Нет адаптера или поля веса — величины 'unknown', не null и не 0
 * (`weightKnown` — можно ли считать шаги).
 */
function weightContext(projectRoot) {
  const weightOf = engines.first(projectRoot, 'instructionWeight');
  const stepsOf = engines.first(projectRoot, 'stepsFromCacheRead');
  const instrWeight = weightOf ? weightOf() : null;
  return {
    instrWeight,
    stepsOf,
    weightKnown: instrWeight !== null && !!stepsOf,
    stepWeight: (node) => ((instrWeight && instrWeight.byNode) || {})[node],
  };
}

/** Разрез по меткам маршрутов для одного движка; `tally.cjs` не читается — `null`. */
function readByRoute(projectRoot, engine) {
  try {
    return require('../tally.cjs').byRoute([boardDir(projectRoot)], engine);
  } catch { return null; } // нет разбора — вкладка покажет «нет данных», а не ноль
}

/** Принятые карточки — файлы `done/` (нет каталога — 0). */
function countAccepted(projectRoot) {
  try {
    return fs.readdirSync(path.join(boardDir(projectRoot), 'done')).filter((f) => f.endsWith('.md')).length;
  } catch { return 0; } // нет done/ — принятых нет
}

/**
 * Разрез по движкам: колонка на тег, токены разных движков не складываются. Общая строка — только общие
 * поля: заходы, время, принятые карточки.
 */
function readByEngine(projectRoot) {
  try {
    const t = require('../tally.cjs').tally([boardDir(projectRoot)]);
    const keys = Object.keys(t.byEngine).sort((a, b) => (a === 'untagged') - (b === 'untagged') || a.localeCompare(b));
    const common = { attempts: 0, seconds: 0, withSeconds: 0, secondsUnknown: 0, accepted: countAccepted(projectRoot) };
    for (const k of keys) {
      const v = t.byEngine[k];
      common.attempts += v.attempts; common.seconds += v.seconds;
      common.withSeconds += v.withSeconds; common.secondsUnknown += v.unknown.duration_s;
    }
    return { keys, columns: t.byEngine, common };
  } catch { return null; } // нет разбора — вкладка покажет «нет данных»
}

/** Карточки только с заходами одного движка (токены и деньги пересчитаны). */
function cardsOfEngine(cards, engine) {
  return cards.map((c) => {
    const a = c.attempts.filter((z) => z.engine === engine);
    return { ...c, attempts: a, tokensTotal: a.reduce((s, z) => s + (z.tokens || 0), 0), costUsdTotal: a.reduce((s, z) => s + z.costUsd, 0) };
  });
}

/** Токенные разрезы — по движку: корпусные поля токенов сложены из разных движков и на вкладке не показываются. */
function engineViews(projectRoot, cards, w) {
  const out = {};
  for (const k of new Set(cards.flatMap((c) => c.attempts.map((z) => z.engine)))) {
    const v = spendViews(cardsOfEngine(cards, k), w);
    out[k] = {
      byNode: v.byNode, totals: v.economy.totals, coverage: v.economy.coverage,
      topCards: v.economy.topCards, byDate: v.economy.byDate, efficiency: v.economy.efficiency,
      byRoute: readByRoute(projectRoot, k),
    };
  }
  return out;
}

/**
 * Расход: `byNode` и `economy` корпуса — только поля без токенов (покрытие, сервисы, слепые пятна, неисправные
 * строки) — плюс `economy.byEngine` и `economy.engines[тег]`.
 */
function buildSpend(projectRoot, cards) {
  const w = weightContext(projectRoot);
  const corpus = spendViews(cards.map((c) => ({ ...c, tokensTotal: 0 })), w);
  const byNode = corpus.byNode.map((n) => ({
    node: n.node, costUsdTotal: n.costUsdTotal, attemptCount: n.attemptCount,
    externalAttemptCount: n.externalAttemptCount, cardCount: n.cardCount,
    secondsTotal: n.secondsTotal, withSeconds: n.withSeconds, avgSeconds: n.avgSeconds,
  }));
  const economy = corpus.economy;
  for (const k of ['totals', 'topCards', 'byDate', 'efficiency']) delete economy[k];
  economy.byEngine = readByEngine(projectRoot);
  economy.engines = engineViews(projectRoot, cards, w);
  return { byNode, economy };
}

module.exports = { buildSpend };
