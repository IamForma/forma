'use strict';

/**
 * Экономика сессий и статья «Intent ↔ человек» (AGENTS.md §3) — расход диалога в основной сессии, отдельно
 * от пяти узлов. Ведомости пишут скрипты адаптера движка (`.forma/dashboard/.cache/session-economy.json`,
 * `session-current.json`, `codex-usage.json`); здесь только чтение: обход стенограмм стоит секунды и
 * гигабайты, и делать его на каждой сборке дашборда нельзя. Поле `cache` из выдачи не переносится — оно
 * служебное и втрое раздувает data.json.
 */

const fs = require('fs');
const { execFileSync } = require('child_process');
const { readJson } = require('../lib/fs.cjs');
const engines = require('../lib/engines.cjs');
const { cachePath, readStatement } = require('./cache.cjs');

/** Полная ведомость сессий с возрастом: стенограммы растут каждый день, вчерашняя — не сегодняшняя. */
const readSessionEconomy = (projectRoot) => readStatement(projectRoot, 'session-economy.json', ['cache']);

// Текущие сессии пересчитываются здесь же (`--session current`, доли секунды), но не чаще раза в минуту:
// сборка дашборда идёт на каждое изменение файла.
const DIALOG_REFRESH_MS = 60 * 1000;

function isStale(file) {
  try { return Date.now() - fs.statSync(file).mtimeMs > DIALOG_REFRESH_MS; }
  catch { return true; } // нет файла — обновить
}

/** Обновляет кэши расхода диалога скриптами, которые объявили адаптеры (`usageRefresh`). */
function refreshUsageCaches(projectRoot) {
  for (const { script, args, cache } of engines.all(projectRoot, 'usageRefresh')) {
    if (!isStale(cachePath(projectRoot, cache))) continue;
    try {
      execFileSync(process.execPath, [engines.resolveRel(projectRoot, script), ...(args || [])],
        { stdio: 'ignore', timeout: 20000 });
    } catch { /* нет стенограмм на этом хосте — покажем то, что есть */ }
  }
}

/** «Всего» — из полной ведомости, как есть, со своим возрастом. */
function totalDialog(se) {
  if (!se || !se.totals) return null;
  return {
    sessions: se.totals.sessions,
    work: (se.totals.input || 0) + (se.totals.output || 0) + (se.totals.cacheCreate || 0),
    cacheRead: se.totals.cacheRead || 0,
    usd: se.totals.bestUsd,
    ageHours: se.ageHours,
  };
}

function currentDialog(current) {
  if (!current || !current.totals) return null;
  return { ...current.totals, generatedAt: current.generatedAt, sessionIds: current.sessions.map((s) => s.sessionId) };
}

function readDialog(projectRoot) {
  refreshUsageCaches(projectRoot);
  const current = readJson(cachePath(projectRoot, 'session-current.json'), null);
  const se = readSessionEconomy(projectRoot);
  const codex = readJson(cachePath(projectRoot, 'codex-usage.json'), null);
  return { current: currentDialog(current), all: totalDialog(se), codex };
}

module.exports = { readSessionEconomy, readDialog };
