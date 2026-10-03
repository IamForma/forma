'use strict';

/**
 * Математика экономики — одна для всех движков.
 * Контракт переменных: .forma/manual/en/03-forma/ECONOMY.md (ru — .forma/manual/ru/03-forma/ECONOMY.md).
 *
 * Модуль читает ТОЛЬКО канонические переменные. Откуда их достать и как назвать
 * поля своего движка — дело адаптера движка (§8 его файла), не этого модуля.
 * Имя движка сюда приходит лишь значением поля `engine` (тег строки) и не сравнивается
 * ни с какой константой.
 *
 * Три состояния поля — без них неполнота записи неотличима от дешевизны:
 *   число      — записано;
 *   null       — маркер `unknown`: движок не вернул, узел назвал это; считается ОТДЕЛЬНО;
 *   undefined  — поле не записано вовсе (строка старше правила); не считается никак.
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isUnknown = (v) => v === null;

/** Пустой накопитель по попыткам (строкам карточек). */
function emptyAcc() {
  return {
    attempts: 0,
    tokens: 0, tokensUnknown: 0,
    seconds: 0, withSeconds: 0, secondsUnknown: 0,
    cacheRead: 0, withCacheRead: 0, cacheUnknown: 0, tokensWithCacheRead: 0,
    work: 0,
    idUnknown: 0,
    usd: 0,
    services: {},
  };
}

/**
 * Одна попытка в накопитель. rec — канонические переменные:
 *   tokens (N, итог), cache_read (R), duration_s (T), call_id, usd, ext_units [{unit, service, amount}].
 * Старое соглашение «R больше N» (N записан без R) приводится: по §3 N включает R.
 */
function addAttempt(acc, rec) {
  acc.attempts += 1;
  let tokens = rec.tokens;
  if (isNum(tokens) && isNum(rec.cache_read) && rec.cache_read > tokens) tokens += rec.cache_read;
  if (isNum(tokens)) acc.tokens += tokens; else if (isUnknown(tokens)) acc.tokensUnknown += 1;
  if (isNum(rec.duration_s)) { acc.seconds += rec.duration_s; acc.withSeconds += 1; }
  else if (isUnknown(rec.duration_s)) acc.secondsUnknown += 1;
  if (isNum(rec.cache_read)) {
    acc.cacheRead += rec.cache_read;
    acc.withCacheRead += 1;
    if (isNum(tokens)) { acc.work += Math.max(0, tokens - rec.cache_read); acc.tokensWithCacheRead += tokens; }
  } else if (isUnknown(rec.cache_read)) acc.cacheUnknown += 1;
  if (isUnknown(rec.call_id)) acc.idUnknown += 1;
  if (isNum(rec.usd)) acc.usd += rec.usd;
  for (const u of rec.ext_units || []) {
    const key = u.service + ' (' + u.unit + ')';
    acc.services[key] = (acc.services[key] || 0) + u.amount;
  }
  return acc;
}

/** Сумма накопителей (карточка → эпик → цикл: одна и та же операция). */
function merge(into, acc) {
  for (const k of Object.keys(into)) {
    if (k === 'services') {
      for (const [s, v] of Object.entries(acc.services)) into.services[s] = (into.services[s] || 0) + v;
    } else into[k] += acc[k];
  }
  return into;
}

/** Разбивка попыток по ключу (узел, карточка, эпик, цикл, тег движка). */
function groupBy(records, keyFn) {
  const out = {};
  for (const r of records) {
    const k = keyFn(r);
    addAttempt(out[k] || (out[k] = emptyAcc()), r);
  }
  return out;
}

/** Разбивка по тегу движка. Строка без тега — ключ `untagged`. Токены разных ключей не складываются. */
const byEngine = (records) => groupBy(records, (r) => r.engine || 'untagged');

/**
 * Доля кэша: R против токенов ТЕХ ЖЕ попыток, у которых R записан.
 * Нет покрытия — null («не записано»), не ноль.
 */
function cacheShare(acc) {
  return acc.withCacheRead && acc.tokensWithCacheRead ? acc.cacheRead / acc.tokensWithCacheRead : null;
}

/** Сколько попыток несут маркер `unknown` хоть в одном поле — отдельная величина отчёта. */
const unknownCount = (acc) => ({ tokens: acc.tokensUnknown, cache_read: acc.cacheUnknown, duration_s: acc.secondsUnknown, call_id: acc.idUnknown });

/**
 * Тренд ряда [{key, value}] (value null — пропуск, не ноль): наклон МНК по точкам с числом.
 * Меньше двух точек — null.
 */
function trend(series) {
  const pts = series.map((p, i) => [i, p.value]).filter(([, v]) => isNum(v));
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((a, [x]) => a + x, 0) / n;
  const my = pts.reduce((a, [, y]) => a + y, 0) / n;
  const den = pts.reduce((a, [x]) => a + (x - mx) ** 2, 0);
  return den ? pts.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0) / den : 0;
}

// ───────── вызовы модели (стенограммы) — те же переменные, по вызову ─────────

/** Пустой накопитель по вызовам модели. */
const emptyUsage = () => ({ calls: 0, tokens_in: 0, tokens_out: 0, cache_read: 0, cache_write: 0 });

/** Один вызов модели: u — канонические tokens_in, tokens_out, cache_read, cache_write. */
function addUsage(acc, u) {
  acc.calls += 1;
  acc.tokens_in += u.tokens_in || 0;
  acc.tokens_out += u.tokens_out || 0;
  acc.cache_read += u.cache_read || 0;
  acc.cache_write += u.cache_write || 0;
  return acc;
}

/** N строки §3: всё, что прошло через окно. */
const usageTokens = (u) => u.tokens_in + u.cache_write + u.cache_read + u.tokens_out;
/** Работа — всё, кроме кэш-чтения (N − R). */
const usageWork = (u) => u.tokens_in + u.tokens_out + u.cache_write;
/** Перечитывание на токен выхода; нет выхода — null. */
const readPerOutput = (u) => (u.tokens_out ? u.cache_read / u.tokens_out : null);

module.exports = {
  emptyAcc, addAttempt, merge, groupBy, byEngine, cacheShare, unknownCount, trend,
  emptyUsage, addUsage, usageTokens, usageWork, readPerOutput,
};
