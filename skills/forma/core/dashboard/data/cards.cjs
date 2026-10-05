'use strict';

/**
 * Карточки для счёта расхода: заходы, сервисы, дата закрытия — и свёртки по эпикам и по доске.
 * Отдельный разбор от доски (`board.cjs`): счёту нужны только строки расхода, доске — поля карточки целиком.
 */

const fs = require('fs');
const path = require('path');
const { walk } = require('../lib/fs.cjs');
const { boardDir, parseFrontmatter, cardTitle } = require('../lib/card.cjs');
const { parseAttempts, parseServiceLines, parseMalformedAttempts, parseClosedDate } = require('./attempts.cjs');

/** Токены карточки/эпика по тегу движка; `unknown tokens` — счётчиком рядом, не нулём. */
function tokensByEngine(attempts) {
  const out = {};
  for (const z of attempts) {
    const o = out[z.engine] || (out[z.engine] = { tokens: 0, attempts: 0, tokensUnknown: 0 });
    o.attempts += 1;
    if (z.tokensUnknown) o.tokensUnknown += 1; else o.tokens += z.tokens;
  }
  return out;
}

/** Складывает разрез по движкам `add` в `acc` (токены разных движков между собой не смешиваются). */
function addByEngine(acc, add) {
  for (const [k, v] of Object.entries(add)) {
    const o = acc[k] || (acc[k] = { tokens: 0, attempts: 0, tokensUnknown: 0 });
    o.tokens += v.tokens; o.attempts += v.attempts; o.tokensUnknown += v.tokensUnknown;
  }
  return acc;
}

/**
 * Один вызов, записанный в нескольких карточках теми же числами, считается один раз; общий id с разными числами — разные окна, считаются все — ключ тот же, что в `tally.cjs`.
 * Строка основной сессии — карточка + id сессии + граница окна: строки с разной границей — приращения
 * одной сессии, все считаются; без метки (накопительные, старые) — первая. `seen` копит ключи по всем карточкам.
 */
function dedupeAttempts(attempts, file, seen) {
  return attempts.filter((z) => {
    if (!z.callId) return true;
    const key = z.sessionSpend ? path.basename(file) + '|' + z.callId + '|' + (z.windowEnd ?? '') : [z.callId, z.tokens, z.cacheRead ?? '', z.seconds ?? ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Дату закрытия пишет САМО расширение доски — поле `completedAt` во фронтматтере, при переезде карточки
 * в `done/`. Это механическая запись: день, когда карточку приняли. Строка `закрыто —` от `Core` — вторая,
 * поздняя отметка: день, когда круг разобран по существу. Первая надёжнее и старше, поэтому она главная.
 */
function closedDateOf(fm, raw) {
  return (fm.completedAt && String(fm.completedAt).slice(0, 10)) || parseClosedDate(raw) || null;
}

function spendCard({ projectRoot, file, raw, fm }, seen) {
  const attempts = dedupeAttempts(parseAttempts(raw), file, seen);
  return {
    id: fm.id,
    title: cardTitle(raw) || fm.id,
    status: fm.status || null,
    priority: fm.priority || null,
    assignee: fm.assignee || null,
    epic: fm.epic || null,
    labels: fm.labels || [],
    done: file.includes(`${path.sep}done${path.sep}`),
    path: path.relative(projectRoot, file).replace(/\\/g, '/'),
    attempts,
    serviceLines: parseServiceLines(raw),
    malformed: parseMalformedAttempts(raw),
    closedDate: closedDateOf(fm, raw),
    // Токены — по тегу движка: разные движки в одну сумму не идут.
    tokensByEngine: tokensByEngine(attempts),
    costUsdTotal: attempts.reduce((s, z) => s + z.costUsd, 0),
  };
}

/** Карточки доски (и `done/`) с заходами и сервисами. Файл без `id` во фронтматтере — не карточка. */
function readSpendCards(projectRoot) {
  const dir = boardDir(projectRoot);
  const files = fs.existsSync(dir) ? walk(dir, { ext: '.md', abs: true }) : [];
  const cards = [];
  const seen = new Set();
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const fm = parseFrontmatter(raw);
    if (!fm.id) continue;
    cards.push(spendCard({ projectRoot, file, raw, fm }, seen));
  }
  return cards;
}

/** Эпики: карточки, статусы, токены по движкам, заходы. Ключ — имя эпика. */
function groupEpics(cards) {
  const epics = {};
  for (const c of cards) {
    const key = c.epic || '(no epic)';
    if (!epics[key]) {
      epics[key] = { epic: key, cardCount: 0, byStatus: {}, tokensByEngine: {}, costUsdTotal: 0, attemptCount: 0, cards: [] };
    }
    const e = epics[key];
    e.cardCount += 1;
    e.byStatus[c.status] = (e.byStatus[c.status] || 0) + 1;
    addByEngine(e.tokensByEngine, c.tokensByEngine);
    e.costUsdTotal += c.costUsdTotal;
    e.attemptCount += c.attempts.length;
    e.cards.push(c);
  }
  return epics;
}

/** Итоги по всей доске. */
function cardTotals(cards, epics) {
  const totals = {
    cardCount: cards.length,
    tokensByEngine: cards.reduce((acc, c) => addByEngine(acc, c.tokensByEngine), {}),
    costUsdTotal: Number(cards.reduce((s, c) => s + c.costUsdTotal, 0).toFixed(6)),
    attemptCount: cards.reduce((s, c) => s + c.attempts.length, 0),
    byStatus: {},
    epicCount: Object.keys(epics).length,
  };
  for (const c of cards) {
    totals.byStatus[c.status] = (totals.byStatus[c.status] || 0) + 1;
  }
  return totals;
}

module.exports = { readSpendCards, groupEpics, cardTotals };
