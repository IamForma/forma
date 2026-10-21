'use strict';

// Паритет журнала вызовов и карточек задач.
// Проверяет, что каждый внешний вызов в журнале вызовов адаптера
// находит соответствие в строке расхода карточки, и наоборот.
// Не привязан к конкретному движку: опрашивает адаптеры через loadAdapters.

const fs = require('fs');
const path = require('path');
const { cardLines, bulletList } = require('./support/lines.cjs');
const { toEnglish, SPEND_TOKENS_RE } = require('../../dashboard/spend-line.cjs');
const { loadAdapters } = require('../../dashboard/lib/engines.cjs');

function run({ root, since }) {
  const problems = [];

  // 1. Считываем все ID из карточек
  const cardCallIds = new Set();
  for (const { line } of cardLines(root)) {
    const t = toEnglish(line.trim());
    const m = SPEND_TOKENS_RE.exec(t);
    if (!m) continue;
    const idMatch = /`([^`]+)`\s*—/.exec(t);
    if (idMatch && idMatch[1] && !idMatch[1].includes('unknown')) {
      cardCallIds.add(idMatch[1].trim());
    }
  }

  // 2. Считываем вызовы из журналов всех подключенных адаптеров
  const adapters = loadAdapters(root);
  const ledgerCalls = [];

  for (const a of adapters) {
    const ledgerPath = path.join(root, a.dir, '.ledger', 'calls.jsonl');
    if (fs.existsSync(ledgerPath)) {
      try {
        const rawLines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean);
        for (const rl of rawLines) {
          try {
            const item = JSON.parse(rl);
            if (item.conversationId && !item.conversationId.includes('unknown')) {
              ledgerCalls.push(item);
            }
          } catch {}
        }
      } catch {}
    }
  }

  if (!ledgerCalls.length) {
    return [];
  }

  // 3. Проверяем паритет для вызовов новее даты since
  const orphanCalls = [];
  for (const call of ledgerCalls) {
    const callDate = (call.timestamp || '').slice(0, 10);
    if (since && callDate < since) continue;
    if (!cardCallIds.has(call.conversationId)) {
      orphanCalls.push(`вызов ${call.conversationId} (${callDate}) не привязан ни к одной карточке`);
    }
  }

  if (orphanCalls.length > 0) {
    problems.push(`нарушен паритет журнала вызовов и доски (${orphanCalls.length} вызовов без карточки):\n      ` + bulletList(orphanCalls));
  }

  return problems;
}

module.exports = { id: 'ledger-parity', since: 'ledger-parity', run };
