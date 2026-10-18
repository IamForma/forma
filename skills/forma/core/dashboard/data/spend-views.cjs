'use strict';

/**
 * Разрезы расхода по набору карточек: по узлам и «экономика» — сколько стоила работа и что об этом вообще известно.
 * Функции чистые: карточки и вес инструктажа приходят снаружи, файлов здесь не читают.
 *
 * Главное правило: рядом с каждой величиной идёт её ПОКРЫТИЕ. Записано 26 заходов на 138 карточек —
 * и без пометки об этом дашборд уверенно скажет «`Spec` дешёвый» там, где правда в том, что `Spec` почти
 * не записывал. Цифра без покрытия опаснее отсутствия цифры: по ней принимают решения.
 */

const { UNKNOWN } = require('../lib/engines.cjs');
const { NODE_ORDER } = require('./nodes.cjs');

const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);

// ---- по узлам -----------------------------------------------------------------------------------

function newNodeAcc(node) {
  return {
    node, tokensTotal: 0, costUsdTotal: 0, attemptCount: 0, externalAttemptCount: 0, cardIds: new Set(),
    secondsTotal: 0, withSeconds: 0, cacheReadTotal: 0, workTotal: 0, withCacheRead: 0,
    cacheReadUnknown: 0, tokensUnknown: 0,
  };
}

function addAttempt(n, z, cardId) {
  n.tokensTotal += z.tokens || 0;
  if (z.tokensUnknown) n.tokensUnknown += 1;
  n.costUsdTotal += z.costUsd;
  n.attemptCount += 1;
  if (z.costUsd > 0 || z.provider) n.externalAttemptCount += 1;
  // Суммируем только записанное. Заход без поля не считается заходом с нулём —
  // иначе среднее поедет вниз и неполнота записи будет выглядеть как дешевизна узла.
  if (z.seconds != null) { n.secondsTotal += z.seconds; n.withSeconds += 1; }
  if (z.cacheRead != null) { n.cacheReadTotal += z.cacheRead; n.workTotal += z.work; n.withCacheRead += 1; }
  if (z.cacheReadUnknown) n.cacheReadUnknown += 1;
  n.cardIds.add(cardId);
}

function foldNodes(cards) {
  const byNodeMap = {};
  for (const c of cards) {
    for (const z of c.attempts) {
      const n = byNodeMap[z.node] || (byNodeMap[z.node] = newNodeAcc(z.node));
      addAttempt(n, z, c.id);
    }
  }
  return Object.values(byNodeMap);
}

function compareNodes(a, b) {
  const ia = NODE_ORDER.indexOf(a.node), ib = NODE_ORDER.indexOf(b.node);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.node.localeCompare(b.node, 'ru');
}

function nodeRow(n, w) {
  const step = w.stepWeight(n.node);
  const known = n.attemptCount - n.tokensUnknown;
  return {
    node: n.node,
    tokensTotal: n.tokensTotal,
    costUsdTotal: Number(n.costUsdTotal.toFixed(6)),
    attemptCount: n.attemptCount,
    externalAttemptCount: n.externalAttemptCount,
    cardCount: n.cardIds.size,
    secondsTotal: n.secondsTotal,
    withSeconds: n.withSeconds,
    cacheReadTotal: n.cacheReadTotal,
    workTotal: n.workTotal,
    withCacheRead: n.withCacheRead,
    // Заходы, где кэш-чтение названо неизвестным: величина сама по себе, не ноль и не пробел (ECONOMY.md, «The `unknown` marker»).
    cacheReadUnknown: n.cacheReadUnknown,
    // Заходы с `unknown tokens` — в числе заходов, но не в сумме и не в среднем.
    tokensUnknown: n.tokensUnknown,
    // Средние — по числу заходов, где поле записано, а не по всем заходам узла.
    avgTokens: known ? Math.round(n.tokensTotal / known) : null,
    avgSeconds: n.withSeconds ? Math.round(n.secondsTotal / n.withSeconds) : null,
    // Доля инструктажа: сколько из токенов ушло на загрузку закона и роли, а не на работу.
    instructionShare: n.withCacheRead && (n.cacheReadTotal + n.workTotal)
      ? Number((n.cacheReadTotal / (n.cacheReadTotal + n.workTotal)).toFixed(3))
      : null,
    // Вес закона и роли на ОДИН шаг вызова (оценка по файлам, не по метаданным).
    instructionPerStep: w.instrWeight === null ? UNKNOWN : (step ? step.perStep : null),
    // Шагов агента в среднем за заход: кэш-чтение, делённое на вес шага. Верхняя оценка: в настоящий input
    // входит ещё системный промпт движка, значит настоящий вес шага больше, а шагов — меньше.
    avgSteps: !w.weightKnown ? UNKNOWN : (n.withCacheRead && step
      ? w.stepsOf(Math.round(n.cacheReadTotal / n.withCacheRead), step.perStep)
      : null),
  };
}

/** Разрез по узлам: кто из пяти сколько токенов/денег потратил и на скольких заходах/карточках. */
function nodeSpend(cards, w) {
  return foldNodes(cards).map((n) => nodeRow(n, w)).sort(compareNodes);
}

// ---- экономика ----------------------------------------------------------------------------------

/**
 * Слепые пятна — карточки, где работа шла, а расход не записан: они объясняют разрыв между «сделано» и
 * «посчитано». `backlog` сюда не входит: там работы ещё не было.
 */
function blindSpotsOf(cards) {
  return cards
    .filter((c) => c.attempts.length === 0 && c.status && c.status !== 'backlog')
    .map((c) => ({ id: c.id, title: c.title, status: c.status, epic: c.epic, done: c.done }));
}

function coverageOf(cards, allAttempts, blindSpotCount) {
  return {
    cardsTotal: cards.length,
    cardsWithAttempts: cards.filter((c) => c.attempts.length > 0).length,
    // Карточки, где работа шла (не backlog) — знаменатель, по которому честно считать долю.
    cardsWorked: cards.filter((c) => c.status && c.status !== 'backlog').length,
    attemptsTotal: allAttempts.length,
    attemptsWithSeconds: allAttempts.filter((z) => z.seconds != null).length,
    attemptsWithCacheRead: allAttempts.filter((z) => z.cacheRead != null).length,
    attemptsCacheReadUnknown: allAttempts.filter((z) => z.cacheReadUnknown).length,
    attemptsTokensUnknown: allAttempts.filter((z) => z.tokensUnknown).length,
    blindSpotCount,
    attemptsWithService: allAttempts.filter((z) => (z.services || []).length).length,
  };
}

function totalsOf(allAttempts) {
  const withSeconds = allAttempts.filter((z) => z.seconds != null);
  const withCacheRead = allAttempts.filter((z) => z.cacheRead != null);
  const totals = {
    tokens: sum(allAttempts, (z) => z.tokens),
    seconds: sum(withSeconds, (z) => z.seconds),
    costUsd: Number(sum(allAttempts, (z) => z.costUsd).toFixed(6)),
    cacheRead: sum(withCacheRead, (z) => z.cacheRead),
    work: sum(withCacheRead, (z) => z.work),
  };
  // Доля инструктажа по проекту целиком — только если есть на чём считать.
  totals.instructionShare = totals.cacheRead + totals.work
    ? Number((totals.cacheRead / (totals.cacheRead + totals.work)).toFixed(3))
    : null;
  return totals;
}

/** Дороже всего обошедшиеся карточки — где искать, что оптимизировать. */
function topCardsOf(attemptsCards) {
  return [...attemptsCards]
    .sort((a, b) => b.tokensTotal - a.tokensTotal)
    .slice(0, 12)
    .map((c) => ({
      id: c.id, title: c.title, status: c.status, epic: c.epic,
      tokens: c.tokensTotal,
      attempts: c.attempts.length,
      seconds: sum(c.attempts.filter((z) => z.seconds != null), (z) => z.seconds),
      nodes: [...new Set(c.attempts.map((z) => z.node))],
    }));
}

/**
 * Эффективность — «токенов на закрытую карточку» по датам: единственная шкала, на которой видно, растёт
 * выгода или нет. Выгода — ЗАКРЫТАЯ КАРТОЧКА, а не потраченные на неё токены.
 *
 * Две оговорки, обе записаны и в отображении:
 *  1. Дата закрытия — `closedDate` (её пишет доска или `Core`); нет — дата ПОСЛЕДНЕГО ЗАХОДА, и тогда
 *     это приблизительно: день, когда работа кончилась, а не когда вынесено решение.
 *  2. Карточки с нулём токенов исключены. Ноль здесь — «в заходах не записаны числа», а не «обошлась даром»:
 *     включив их, плохой учёт выглядел бы ростом эффективности.
 */
function efficiencyByDate(closedWithSpend) {
  const byDateMap = {};
  for (const c of closedWithSpend) {
    const last = c.closedDate || c.attempts.map((z) => z.date).sort().pop();
    if (!byDateMap[last]) byDateMap[last] = { date: last, cards: 0, tokens: 0, attempts: 0, exact: 0 };
    if (c.closedDate) byDateMap[last].exact += 1;
    byDateMap[last].cards += 1;
    byDateMap[last].tokens += c.tokensTotal;
    byDateMap[last].attempts += c.attempts.length;
  }
  return Object.values(byDateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, perCard: Math.round(d.tokens / d.cards) }));
}

function efficiencyOf(attemptsCards) {
  const closedWithSpend = attemptsCards.filter((c) => c.status === 'done' && c.tokensTotal > 0);
  const efficiency = {
    byDate: efficiencyByDate(closedWithSpend),
    cardsCounted: closedWithSpend.length,
    // Сколько закрытых карточек с заходами выброшено из-за нулей — без этого «посчитано по 5 карточкам»
    // неотличимо от «посчитано по всем закрытым».
    cardsDroppedZero: attemptsCards.filter((c) => c.status === 'done' && !c.tokensTotal).length,
    // Сколько карточек отнесено к ТОЧНОЙ дате закрытия; пока никто не пишет строку закрытия, здесь ноль.
    cardsWithClosedDate: closedWithSpend.filter((c) => c.closedDate).length,
    tokensTotal: sum(closedWithSpend, (c) => c.tokensTotal),
  };
  efficiency.perCard = efficiency.cardsCounted
    ? Math.round(efficiency.tokensTotal / efficiency.cardsCounted)
    : null;
  return efficiency;
}

/**
 * Внешние сервисы. Группа — пара «сервис + единица», а не один сервис: один поставщик может считать в разных
 * единицах (кредиты за генерацию, минуты за рендер), и складывать их в одно число — получить несуществующую
 * величину. Обе формы записи: сегмент внутри захода узла и отдельная строка `Сервис,`.
 */
function serviceEvents(allAttempts, cards) {
  return [
    ...allAttempts.flatMap((z) => (z.services || []).map((sv) => ({ ...sv, date: z.date, cardId: z.cardId }))),
    ...cards.flatMap((c) => (c.serviceLines || []).map((sv) => ({ ...sv, cardId: c.id }))),
  ];
}

function foldServices(events) {
  const byServiceMap = {};
  for (const sv of events) {
    const key = `${sv.service}|${sv.unit.toLowerCase()}`;
    if (!byServiceMap[key]) {
      byServiceMap[key] = {
        service: sv.service, unit: sv.unit, amount: 0, calls: 0,
        operations: {}, cardIds: new Set(), firstDate: sv.date, lastDate: sv.date,
      };
    }
    const g = byServiceMap[key];
    g.amount += sv.amount;
    g.calls += 1;
    g.operations[sv.operation] = (g.operations[sv.operation] || 0) + sv.amount;
    g.cardIds.add(sv.cardId);
    if (sv.date < g.firstDate) g.firstDate = sv.date;
    if (sv.date > g.lastDate) g.lastDate = sv.date;
  }
  return Object.values(byServiceMap);
}

function byServiceOf(allAttempts, cards) {
  return foldServices(serviceEvents(allAttempts, cards))
    .map((g) => ({
      service: g.service,
      unit: g.unit,
      amount: g.amount,
      calls: g.calls,
      cardCount: g.cardIds.size,
      firstDate: g.firstDate,
      lastDate: g.lastDate,
      // Дороже всего обошедшиеся операции — где у сервиса утекает больше всего.
      operations: Object.entries(g.operations)
        .map(([operation, amount]) => ({ operation, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function byDateOf(allAttempts) {
  const byDateMap = {};
  for (const z of allAttempts) {
    if (!byDateMap[z.date]) byDateMap[z.date] = { date: z.date, tokens: 0, seconds: 0, attempts: 0, costUsd: 0 };
    const d = byDateMap[z.date];
    d.tokens += z.tokens || 0;
    d.seconds += z.seconds || 0;
    d.costUsd += z.costUsd;
    d.attempts += 1;
  }
  return Object.values(byDateMap).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Строки, где стоит слово «заход», а чисел нет вовсе — расход был, запись не удалась. Держатся ОТДЕЛЬНО
 * от законных нулей: смешивать их значит обвинять в небрежности ту работу, где §3 расхода и не требует.
 */
function malformedOf(cards) {
  return cards
    .filter((c) => c.malformed && c.malformed.length)
    .flatMap((c) => c.malformed.map((line) => ({ cardId: c.id, title: c.title, line })));
}

function economyView(cards, w) {
  const allAttempts = cards.flatMap((c) => c.attempts.map((z) => ({ ...z, cardId: c.id, cardTitle: c.title })));
  const attemptsCards = cards.filter((c) => c.attempts.length > 0);
  const blindSpots = blindSpotsOf(cards);
  return {
    // Покрытие — первое, что читается, и потому стоит первым полем.
    coverage: coverageOf(cards, allAttempts, blindSpots.length),
    totals: totalsOf(allAttempts),
    topCards: topCardsOf(attemptsCards),
    byService: byServiceOf(allAttempts, cards),
    byDate: byDateOf(allAttempts),
    blindSpots: blindSpots.slice(0, 40),
    efficiency: efficiencyOf(attemptsCards),
    malformed: malformedOf(cards),
    // Вес инструктажа — единственная величина, посчитанная из файлов, а не прочитанная из записи; отсюда
    // `estimate: true` внутри: отображение обязано назвать её оценкой.
    instruction: w.instrWeight === null ? UNKNOWN : w.instrWeight,
  };
}

/**
 * Разрезы расхода по набору карточек: зовётся на весь корпус (поля без токенов — покрытие, слепые пятна,
 * сервисы) и на каждый тег движка отдельно (всё, где токены): токены разных движков в одну сумму не идут.
 * `w` — вес инструктажа (`weightContext` в `spend.cjs`).
 */
function spendViews(cards, w) {
  return { byNode: nodeSpend(cards, w), economy: economyView(cards, w) };
}

module.exports = { spendViews };
