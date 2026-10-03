'use strict';

/**
 * Реестр постоянных субагентов (`.forma/dashboard/.cache/subagents-registry.json`) — пишет `.forma/dashboard/subagents-log.cjs`
 * при каждой записи в `subagents.log`; здесь только читаем для панели дашборда. Мягкое предупреждение
 * вместо точного обратного отсчёта: семантика retention документацией однозначно не подтверждена.
 */

const { readJson } = require('../lib/fs.cjs');
const { cachePath } = require('./cache.cjs');

const SUBAGENT_STALE_DAYS = 25;

// Тот же casual-парсинг времени, что и `timeAgo()` в index.html — формат «ГГГГ-ММ-ДД ЧЧ:ММ», не строгий ISO
// (единая конвенция логов проекта).
function parseLogTimestamp(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(s || '');
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
}

function subagentRow(agent, r, now) {
  const lastUsedMs = parseLogTimestamp(r.last_used_at);
  const daysSinceUse = lastUsedMs != null ? (now - lastUsedMs) / 86400000 : null;
  return {
    agent,
    role: r.role || null,
    hiredAt: r.hired_at || null,
    lastUsedAt: r.last_used_at || null,
    calls: r.calls || 0,
    tokensTotal: r.tokens_total || 0,
    stale: daysSinceUse != null ? daysSinceUse > SUBAGENT_STALE_DAYS : false,
  };
}

/** Постоянные субагенты, свежие сверху; реестра нет — пусто. */
function readSubagentsRegistry(projectRoot) {
  const registry = readJson(cachePath(projectRoot, 'subagents-registry.json'), null);
  if (registry === null) return [];
  const now = Date.now();
  return Object.entries(registry)
    .map(([agent, r]) => subagentRow(agent, r, now))
    .sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : a.lastUsedAt > b.lastUsedAt ? -1 : 0));
}

module.exports = { readSubagentsRegistry };
