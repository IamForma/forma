'use strict';

// Паритет журнала вызовов и карточек задач — в обе стороны.
// Для каждого адаптера с файлом `<dir>/.ledger/calls.jsonl` (адаптеры — из loadAdapters):
//   журнал → карточка: вызов не старше `since` (conversationId без `unknown`), чьего id нет ни в одной строке
//     расхода карточек, — находка;
//   карточка → журнал: строка расхода с меткой движка этого адаптера, с id вызова (не `id unknown`, не строка
//     основной сессии `card-session-spend`), датой не раньше `since` и строго позже первого дня журнала этого адаптера
//     (строки дня установки журнала частично предшествуют хуку, а в строке только дата — сверять не с чем), чьего id нет в журнале, — находка;
//   журнал есть, но пуст, а строки расхода этого движка в окне сверки есть — находка (молчание тут было бы ложным «ок»).
// Нет файла журнала — адаптер не сверяется. Движок определяется по метке `spendTag` после тире строки.

const fs = require('fs');
const path = require('path');
const { cardLines, bulletList } = require('./support/lines.cjs');
const { toEnglish, SPEND_TOKENS_RE } = require('../../dashboard/spend-line.cjs');
const { loadAdapters } = require('../../dashboard/lib/engines.cjs');

const LINE_DATE_RE = /(\d{4}-\d{2}-\d{2}):\s*attempt,/;
const LINE_ID_RE = /,\s*`([^`\s]+)`\s*—/;
const LINE_TAG_RE = /—\s*([a-z][a-z0-9-]*):/;

/** Вызовы журнала адаптера; `null` — файла нет, `[]` — файл есть, но пуст. */
function readLedger(root, adapter) {
  const ledgerPath = path.join(root, adapter.dir, '.ledger', 'calls.jsonl');
  if (!fs.existsSync(ledgerPath)) return null;
  const calls = [];
  let text = '';
  try { text = fs.readFileSync(ledgerPath, 'utf8'); } catch { return null; }
  for (const rl of text.split(/\r?\n/).filter(Boolean)) {
    try {
      const item = JSON.parse(rl);
      if (item.conversationId && !String(item.conversationId).includes('unknown')) calls.push(item);
    } catch {}
  }
  return calls;
}

/** Строки расхода карточек: `{ file, date, id, tag }`; id `null` — `id unknown` или не записан. */
function spendRows(root) {
  const rows = [];
  for (const { file, line } of cardLines(root)) {
    const t = toEnglish(line.trim());
    const d = LINE_DATE_RE.exec(t);
    if (!d || !/^-\s/.test(t)) continue;
    const idm = LINE_ID_RE.exec(t);
    const id = idm && !idm[1].includes('unknown') ? idm[1].trim() : null;
    const tag = LINE_TAG_RE.exec(t);
    rows.push({ file, date: d[1], id, tag: tag ? tag[1] : null, session: /card-session-spend/.test(t), tokens: SPEND_TOKENS_RE.test(t) });
  }
  return rows;
}

function run({ root, since }) {
  const problems = [];
  const rows = spendRows(root);
  const cardCallIds = new Set(rows.filter((r) => r.id).map((r) => r.id));

  const ledgers = [];
  for (const a of loadAdapters(root)) {
    const calls = readLedger(root, a);
    if (calls) ledgers.push({ adapter: a, calls });
  }

  // журнал → карточка
  const orphanCalls = [];
  for (const { calls } of ledgers) {
    for (const call of calls) {
      const callDate = (call.timestamp || '').slice(0, 10);
      if (since && callDate < since) continue;
      if (!cardCallIds.has(call.conversationId)) {
        orphanCalls.push(`вызов ${call.conversationId} (${callDate}) не привязан ни к одной карточке`);
      }
    }
  }
  if (orphanCalls.length > 0) {
    problems.push(`нарушен паритет журнала вызовов и доски (${orphanCalls.length} вызовов без карточки):\n      ` + bulletList(orphanCalls));
  }

  // карточка → журнал
  const orphanRows = [];
  for (const { adapter, calls } of ledgers) {
    const tag = adapter.spendTag || adapter.tag || adapter.engine;
    const first = calls.map((c) => (c.timestamp || '').slice(0, 10)).filter(Boolean).sort()[0];
    const inWindow = rows.filter((r) => r.tag === tag && !r.session && r.id && (!since || r.date >= since));
    if (!calls.length) {
      if (inWindow.length) problems.push(`журнал вызовов ${adapter.dir}/.ledger/calls.jsonl пуст, а в карточках ${inWindow.length} строк расхода «${tag}» с id вызова — сверять не с чем`);
      continue;
    }
    const ids = new Set(calls.map((c) => c.conversationId));
    for (const r of inWindow) {
      if (first && r.date <= first) continue;
      if (!ids.has(r.id)) orphanRows.push(`${r.file}: строка расхода (${r.date}) с id ${r.id} — вызова нет в журнале ${adapter.dir}/.ledger`);
    }
  }
  if (orphanRows.length > 0) {
    problems.push(`нарушен паритет доски и журнала вызовов (${orphanRows.length} строк расхода без вызова в журнале):\n      ` + bulletList(orphanRows));
  }

  return problems;
}

module.exports = { id: 'ledger-parity', since: 'ledger-parity', run };
