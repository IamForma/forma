'use strict';

/**
 * Скорость и эффективность по движкам: выходные токены в секунду, секунды на попытку, попытки на закрытую
 * карточку, токены и цена на закрытую карточку, доля кэша. Функция чистая: карточки приходят снаружи.
 *
 * Правила знаменателя (ECONOMY.md, «The `unknown` marker»):
 *   - скорость = выходные токены / секунды только по попыткам, где известны ОБА числа; строки `out unknown` (и
 *     старые без сегмента `out`) в знаменатель не входят и считаются отдельно (`outUnknown`) — их не видно
 *     иначе, чем пометкой;
 *   - секунды на попытку — по попыткам с записанным временем;
 *   - «на закрытую карточку» — по карточкам `done`, где у движка есть хотя бы одна попытка;
 *   - доля кэша — кэш-чтение / токены по попыткам, где записаны оба.
 * Ни одно имя движка не сравнивается: ключ — тег строки расхода.
 */

const ALL = 'all';
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function emptyRow() {
  return {
    attempts: 0, closedCards: 0, closedAttempts: 0, closedTokens: 0, closedUsd: 0,
    out: 0, outSeconds: 0, outAttempts: 0, outUnknown: 0,
    seconds: 0, withSeconds: 0,
    cacheRead: 0, cacheTokens: 0,
  };
}

function finish(r) {
  const div = (a, b) => (b > 0 ? a / b : null);
  return {
    attempts: r.attempts,
    closedCards: r.closedCards,
    outPerSec: div(r.out, r.outSeconds),
    outAttempts: r.outAttempts,
    outUnknown: r.outUnknown,
    secPerAttempt: div(r.seconds, r.withSeconds),
    withSeconds: r.withSeconds,
    attemptsPerClosed: div(r.closedAttempts, r.closedCards),
    tokensPerClosed: div(r.closedTokens, r.closedCards),
    usdPerClosed: div(r.closedUsd, r.closedCards),
    cacheShare: div(r.cacheRead, r.cacheTokens),
  };
}

/**
 * Срез «движок + модель»: модель — из `z.model` строки, иначе из таблицы узел-модель адаптера (`modelOf(движок, узел)`),
 * нет ни того ни другого — строка `unknown` (не ноль). Знаменатель скорости — только попытки с известными out и секундами.
 */
const UNKNOWN_MODEL = 'unknown';
function modelRows(cards, modelOf) {
  const acc = {};
  for (const c of cards) {
    for (const z of c.attempts) {
      const model = (typeof z.model === 'string' && z.model) || (modelOf && modelOf(z.engine, z.node)) || UNKNOWN_MODEL;
      const key = z.engine + '|' + model;
      const r = acc[key] || (acc[key] = { engine: z.engine, model, attempts: 0, out: 0, outSeconds: 0, outAttempts: 0, outUnknown: 0 });
      r.attempts += 1;
      const sec = num(z.seconds), out = num(z.tokensOut);
      if (out != null && sec != null && sec > 0) { r.out += out; r.outSeconds += sec; r.outAttempts += 1; }
      else if (out == null) r.outUnknown += 1;
    }
  }
  return Object.values(acc)
    .map((r) => ({ ...r, outPerSec: r.outSeconds > 0 ? r.out / r.outSeconds : null }))
    .sort((a, b) => a.engine.localeCompare(b.engine) || (a.model === UNKNOWN_MODEL) - (b.model === UNKNOWN_MODEL) || a.model.localeCompare(b.model));
}

/** Строки по движкам для набора карточек. */
function rowsOf(cards) {
  const acc = {};
  const at = (k) => acc[k] || (acc[k] = emptyRow());
  for (const c of cards) {
    const mine = {};
    for (const z of c.attempts) {
      const r = at(z.engine);
      r.attempts += 1;
      const sec = num(z.seconds);
      if (sec != null) { r.seconds += sec; r.withSeconds += 1; }
      const out = num(z.tokensOut);
      if (out != null && sec != null && sec > 0) { r.out += out; r.outSeconds += sec; r.outAttempts += 1; }
      else if (out == null) r.outUnknown += 1;
      const tok = num(z.tokens), cr = num(z.cacheRead);
      if (tok != null && cr != null) { r.cacheRead += cr; r.cacheTokens += tok; }
      (mine[z.engine] || (mine[z.engine] = [])).push(z);
    }
    if (c.status !== 'done') continue;
    for (const [k, list] of Object.entries(mine)) {
      const r = at(k);
      r.closedCards += 1;
      r.closedAttempts += list.length;
      r.closedTokens += list.reduce((s, z) => s + (num(z.tokens) || 0), 0);
      r.closedUsd += list.reduce((s, z) => s + (num(z.costUsd) || 0), 0);
    }
  }
  return Object.fromEntries(Object.entries(acc).map(([k, r]) => [k, finish(r)]));
}

/**
 * `{ kinds, byKind }`: `byKind.all` — все карточки, `byKind[вид]` — только карточки этого вида (поле kind карточки);
 * в каждом `{ engines: { тег: строка } }`. Движки без попыток в выборке отсутствуют; список `extraTags` (движки
 * с адаптером) добавляется пустыми строками, чтобы колонка была от папки движка.
 */
function buildSpeed(cards, extraTags = [], modelOf = null) {
  const kinds = [...new Set(cards.filter((c) => c.attempts.length && c.kind).map((c) => c.kind))].sort((a, b) => a.localeCompare(b, 'ru'));
  const byKind = { [ALL]: { engines: rowsOf(cards), models: modelRows(cards, modelOf) } };
  for (const k of kinds) {
    const sub = cards.filter((c) => c.kind === k);
    byKind[k] = { engines: rowsOf(sub), models: modelRows(sub, modelOf) };
  }
  for (const v of Object.values(byKind)) {
    for (const tag of extraTags) if (!(tag in v.engines)) v.engines[tag] = finish(emptyRow());
  }
  return { kinds, byKind };
}

module.exports = { buildSpeed, ALL, UNKNOWN_MODEL };
