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
    attempts: 0, outKnown: 0, closedCards: 0, closedAttempts: 0, closedTokens: 0, closedUsd: 0,
    out: 0, outSeconds: 0, outAttempts: 0, outUnknown: 0,
    seconds: 0, withSeconds: 0,
    cacheRead: 0, cacheTokens: 0,
  };
}

function finish(r) {
  const div = (a, b) => (b > 0 ? a / b : null);
  return {
    attempts: r.attempts,
    outKnown: r.outKnown,
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
      if (out != null) r.outKnown += 1;
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

/**
 * Сводка по движкам для верха вкладки «Экономика»: чистая функция, карточки и записи журналов приходят снаружи.
 * Метрика — `{ v, n, m, low, rank }`: значение (или null), наблюдений, возможных, пометка «мало данных (n из m)».
 *   - секунд / токенов на закрытую карточку: сумма по попыткам закрытых карточек движка / число закрытых карточек;
 *     n — закрытые карточки с известной величиной, m — закрытые карточки движка; rank — 1 у меньшего;
 *   - доля повторных попыток: (попытки закрытых карточек − закрытые карточки) / попытки закрытых карточек;
 *   - задержка до ответа: медиана `first_response_s` по записям журнала; нет поля — null (не ноль);
 *   - токены на секунду активной работы: Σ output_tokens / Σ время, по записям журнала с обоими числами; у продолжения
 *     выход — прирост против прошлой записи вызова, время — `active_s`; иначе `duration_s`. Без догадок.
 * Малая выборка: n < MIN_N; для метрики по выходу — ещё и известный выход у меньше чем половины попыток (по карточкам)
 * или записей журнала. Число остаётся, низкая выборка только помечается.
 * `ledgers`: `{ тег движка: [записи журнала] }`; теги — основные метки (после canonicalTag).
 */
const MIN_N = 5;
const metric = (v, n, m, extraLow = false) => ({ v: n > 0 ? v : null, n, m, low: n > 0 && (n < MIN_N || extraLow) });

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

function ledgerStats(records) {
  const recs = Array.isArray(records) ? records : [];
  const first = recs.map((r) => num(r && r.first_response_s)).filter((x) => x != null && x >= 0);
  const lastOut = new Map();
  let out = 0, sec = 0, used = 0, knownOut = 0;
  for (const r of [...recs].sort((a, b) => String(a && a.timestamp).localeCompare(String(b && b.timestamp)))) {
    if (!r) continue;
    const o = num(r.output_tokens);
    if (o != null) knownOut += 1;
    const id = r.conversationId;
    const prev = lastOut.has(id) ? lastOut.get(id) : null;
    let dOut = o, t = num(r.duration_s);
    if (r.continuation) { t = num(r.active_s); dOut = o != null && prev != null ? o - prev : null; }
    if (o != null) lastOut.set(id, o);
    if (dOut != null && dOut >= 0 && t != null && t > 0) { out += dOut; sec += t; used += 1; }
  }
  return { records: recs.length, first, out, sec, used, knownOut };
}

/**
 * Расход и производительность по строкам `## История`. `engine` — тег или `null` («Итого» по всем движкам).
 *   - расход всего: сумма по попыткам с известной величиной; n — такие попытки, m — все попытки;
 *   - цена $: только попытки с записанной ценой (сегмент `$` или провайдер) — нет цены, это не ноль, а «нет данных»;
 *   - на закрытую карточку: сумма по попыткам закрытых карточек / число закрытых карточек с известной величиной;
 *   - токены out в секунду вызова: Σ out / Σ секунд по попыткам, где известны оба числа и секунды > 0.
 */
function spendOf(cards, engine) {
  const s = { att: 0, tok: 0, tokN: 0, usd: 0, usdN: 0, sec: 0, secN: 0, out: 0, outSec: 0, outN: 0, outKnown: 0,
    closed: 0, closedAttempts: 0, cTok: 0, cTokCards: 0, cUsd: 0, cUsdCards: 0, cSec: 0, cSecCards: 0 };
  for (const c of cards) {
    const list = c.attempts.filter((z) => engine == null || z.engine === engine);
    if (!list.length) continue;
    for (const z of list) {
      s.att += 1;
      const tok = num(z.tokens), sec = num(z.seconds), out = num(z.tokensOut);
      const priced = z.provider != null || (num(z.costUsd) || 0) > 0;
      if (tok != null) { s.tok += tok; s.tokN += 1; }
      if (priced) { s.usd += num(z.costUsd) || 0; s.usdN += 1; }
      if (sec != null) { s.sec += sec; s.secN += 1; }
      if (out != null) s.outKnown += 1;
      if (out != null && sec != null && sec > 0) { s.out += out; s.outSec += sec; s.outN += 1; }
    }
    if (c.status !== 'done') continue;
    s.closed += 1; s.closedAttempts += list.length;
    const sum = (f) => { const xs = list.map(f).filter((x) => x != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; };
    const t = sum((z) => num(z.tokens)), u = sum((z) => (z.provider != null || (num(z.costUsd) || 0) > 0 ? num(z.costUsd) || 0 : null)), q = sum((z) => num(z.seconds));
    if (t != null) { s.cTok += t; s.cTokCards += 1; }
    if (u != null) { s.cUsd += u; s.cUsdCards += 1; }
    if (q != null) { s.cSec += q; s.cSecCards += 1; }
  }
  const outLow = s.att > 0 && s.outKnown / s.att < 0.5;
  return {
    closedCards: s.closed,
    secPerClosed: metric(s.cSec / (s.cSecCards || 1), s.cSecCards, s.closed),
    tokensPerClosed: metric(s.cTok / (s.cTokCards || 1), s.cTokCards, s.closed),
    usdPerClosed: metric(s.cUsd / (s.cUsdCards || 1), s.cUsdCards, s.closed),
    retryShare: metric(s.closedAttempts ? (s.closedAttempts - s.closed) / s.closedAttempts : null, s.closed, s.closed),
    tokensTotal: metric(s.tok, s.tokN, s.att),
    usdTotal: metric(s.usd, s.usdN, s.att),
    secTotal: metric(s.sec, s.secN, s.att),
    outPerCallSec: metric(s.outSec > 0 ? s.out / s.outSec : null, s.outN, s.att, outLow),
    outKnownShare: s.att ? s.outKnown / s.att : null,
  };
}

function buildSummary(cards, ledgers = {}, extraTags = []) {
  const cardTags = new Set();
  for (const c of cards) for (const z of c.attempts) cardTags.add(z.engine);
  const rows = rowsOf(cards);
  const tags = [...new Set([...cardTags, ...Object.keys(ledgers), ...extraTags])].sort((a, b) => a.localeCompare(b));
  const engines = {};
  const ledgerOf = (l, sp) => {
    const cardOutShare = sp && sp.attempts ? sp.outKnown / sp.attempts : null;
    const ledgerOutShare = l.records ? l.knownOut / l.records : null;
    const outLow = (cardOutShare != null && cardOutShare < 0.5) || (ledgerOutShare != null && ledgerOutShare < 0.5);
    return {
      firstResponse: metric(median(l.first), l.first.length, l.records),
      outPerActiveSec: metric(l.sec > 0 ? l.out / l.sec : null, l.used, l.records, outLow),
    };
  };
  const pooled = { records: 0, first: [], out: 0, sec: 0, used: 0, knownOut: 0 };
  for (const k of tags) {
    const l = ledgerStats(ledgers[k]);
    engines[k] = { ...spendOf(cards, k), ...ledgerOf(l, rows[k]) };
    pooled.records += l.records; pooled.first.push(...l.first); pooled.out += l.out; pooled.sec += l.sec;
    pooled.used += l.used; pooled.knownOut += l.knownOut;
  }
  // Итого по всем движкам: карточка с попытками двух движков считается закрытой один раз.
  const allRows = Object.values(rows);
  const total = { ...spendOf(cards, null), ...ledgerOf(pooled, { attempts: allRows.reduce((s, r) => s + r.attempts, 0), outKnown: allRows.reduce((s, r) => s + r.outKnown, 0) }) };
  // Рейтинг: 1-е место — меньше; только среди движков со значением.
  for (const key of ['secPerClosed', 'tokensPerClosed']) {
    tags.filter((k) => engines[k][key].v != null).sort((x, y) => engines[x][key].v - engines[y][key].v)
      .forEach((k, i) => { engines[k][key].rank = i + 1; });
  }
  return { minN: MIN_N, tags, engines, total };
}

module.exports = { buildSpeed, buildSummary, ALL, UNKNOWN_MODEL, MIN_N };
