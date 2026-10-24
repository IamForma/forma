#!/usr/bin/env node
'use strict';

/**
 * Автозапись расхода вызова субагента Claude Code: хук `SubagentStop` → журнал → строка в карточку.
 * Контракт — .forma/manual/en/03-protocol/ECONOMY.md, «Automatic recording (adapter duty)».
 *
 * Вход — JSON хука на stdin (ожидаемо: agent_id, agent_type, agent_transcript_path, session_id, cwd; поля не гарантированы).
 * 1. Читает стенограмму вызова (путь из события, иначе поиск по agent_id как в subagent-transcript.cjs):
 *    шаги дедуплицируются по requestId; N = in + write + read + out; T = от первой до последней записи, целые секунды.
 * 2. Дописывает запись в `.claude/.ledger/calls.jsonl`: { timestamp, conversationId: agent_id, engine: 'claude-code',
 *    node: agent_type, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, duration_s, cards }.
 *    Числа записи — нарастающие итоги стенограммы. Повторный SubagentStop того же agent_id (SendMessage-продолжение) —
 *    новая запись с continuation: true; тот же итог без прироста — не пишется.
 * 3. В `## История` каждой карточки из cards (номера `card-NNN` из первого сообщения пользователя стенограммы (правило — `cardsIn`)), найденной на
 *    доске или в done/, дописывает строку §3 через formatSpendLine. K>1 найденных карточек — N, R, O, T делятся
 *    (splitForBatch, пометка `batch I/K`). В карточку идёт доля минус уже учтённое по этому call id (продолжение — дельта);
 *    у не-продолжения строка с этим call id уже в карточке (записана рукой) — не дублируется.
 * Любая ошибка → exit 0, причина в stderr и `.claude/.ledger/errors.log`. Хук никогда не блокирует.
 * CLAUDE_LEDGER_DEBUG=1 — сырой вход в `.claude/.ledger/raw-last.json`. CLAUDE_LEDGER_ROOT — корень проекта (тесты).
 *
 * Строка продолжения несёт `attempt,` (как требует разбор доски) и пометку `продолжение` в описании после тире.
 *
 * Запуск: node .claude/scripts/ledger-recorder.cjs < событие.json
 */

const fs = require('fs');
const path = require('path');

const { formatSpendLine, ATTEMPT_FORMAT_RE, outTokens, toInt } = require('../../.forma/dashboard/spend-line.cjs');
const economy = require('../../.forma/dashboard/economy.cjs');
const { findTranscript } = require('../../.forma/dashboard/subagent-transcript.cjs');
const { cardFiles } = require('../../.forma/dashboard/lib/card.cjs');
const i18n = require('../../.forma/i18n/index.cjs');
const { claudeUsage, splitForBatch } = require('./claude-economy.cjs');

const ENGINE_TAG = 'claude-code';
const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');

const NODE_BY_TYPE = { kit: 'Kit', spec: 'Spec', core: 'Core', intent: 'Intent', 'plumb-haiku': 'Plumb' };
/** agent_type → имя узла в строке: kit→Kit, spec→Spec, core→Core, intent→Intent, run*→Run, plumb-haiku→Plumb; иное — как есть. */
function nodeOf(agentType) {
  const t = String(agentType || '').trim();
  if (!t) return 'unknown';
  if (NODE_BY_TYPE[t]) return NODE_BY_TYPE[t];
  if (/^run($|[-_])/i.test(t)) return 'Run';
  return t;
}

function ledgerDir(root) { return path.join(root, '.claude', '.ledger'); }

function logError(root, msg) {
  const text = `[ledger-recorder] ${msg}`;
  try { process.stderr.write(text + '\n'); } catch {}
  try {
    fs.mkdirSync(ledgerDir(root), { recursive: true });
    fs.appendFileSync(path.join(ledgerDir(root), 'errors.log'), `${new Date().toISOString()} ${text}\n`, 'utf8');
  } catch {}
}

/** Стенограмма вызова: шаги по requestId, время по первой и последней записи, первое сообщение пользователя. */
function readCall(file) {
  const seen = new Set();
  const t = economy.emptyUsage();
  let first = null, last = null, prompt = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    const ts = j.timestamp ? Date.parse(j.timestamp) : NaN;
    if (Number.isFinite(ts)) { if (first == null || ts < first) first = ts; if (last == null || ts > last) last = ts; }
    if (prompt == null && j.type === 'user' && j.message && j.message.role === 'user') {
      const c = j.message.content;
      const text = typeof c === 'string' ? c
        : Array.isArray(c) ? c.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n') : '';
      if (text) prompt = text;
    }
    const u = j.message && j.message.usage;
    if (!u || u.cache_read_input_tokens == null) continue;
    const key = j.requestId || j.uuid;
    if (seen.has(key)) continue;
    seen.add(key);
    economy.addUsage(t, claudeUsage(u));
  }
  if (!t.calls) return null;
  return {
    steps: t.calls, tokens_in: t.tokens_in, tokens_out: t.tokens_out, cache_read: t.cache_read, cache_write: t.cache_write,
    duration_s: first != null && last != null ? Math.round((last - first) / 1000) : null,
    prompt: prompt || '',
  };
}

function readLedger(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

/** Уже учтено в карточке по call id: Σ N, R, O, T по строкам расхода с этим id. */
function accountedInCard(text, callId) {
  const re = new RegExp(ATTEMPT_FORMAT_RE.source, 'g');
  const acc = { tokens: 0, cache: 0, out: 0, seconds: 0, lines: 0 };
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('- ') || !line.includes('`' + callId + '`')) continue;
    re.lastIndex = 0;
    const m = re.exec(line);
    if (!m) continue;
    acc.tokens += toInt(m[3]);
    if (m[4]) acc.cache += toInt(m[4].replace(/[^\d]/g, ''));
    const o = outTokens(line);
    if (o != null) acc.out += o;
    if (m[5]) acc.seconds += toInt(m[5].replace(/[^\d]/g, ''));
    acc.lines += 1;
  }
  return acc;
}

/** Строку — в конец зоны «История» (перед зоной результата), как card-move.cjs. */
function insertIntoHistory(text, spendLine) {
  const lines = text.split('\n');
  const head = i18n.headingRe('zone.history', '');
  const i = lines.findIndex((l) => head.test(l.replace(/\r$/, '')));
  if (i < 0) return null;
  let end = lines.findIndex((l, k) => k > i && l.startsWith('## '));
  if (end < 0) end = lines.length;
  let at = end;
  while (at > i + 1 && !lines[at - 1].trim()) at--;
  lines.splice(at, 0, spendLine);
  return lines.join('\n');
}

/**
 * Обслуженная карточка — только та, чей номер стоит (а) в строке «Карточка: …» / «Card: …» или (б) в пути файла
 * `.devtool/features/card-NNN-…` / `done/card-NNN-…` из промпта. Прочие упоминания (`after-card-NNN`, «см. card-NNN»,
 * «после card-NNN») не считаются. Не нашлось ни одной — [].
 */
function cardsIn(prompt) {
  const set = new Set();
  const text = String(prompt);
  for (const line of text.split(/\r?\n/)) {
    if (!/^\s*(?:Карточк[аи]|Card)\s*:/i.test(line)) continue;
    for (const m of line.matchAll(/(?<![\w-])card-(\d{3})(?!\d)/g)) set.add(m[1]);
  }
  for (const m of text.matchAll(/\.devtool[\/]features[\/](?:done[\/])?card-(\d{3})-/g)) set.add(m[1]);
  return [...set].sort();
}

function record(payload, opts = {}) {
  const root = opts.root || process.env.CLAUDE_LEDGER_ROOT || DEFAULT_ROOT;
  const result = { recorded: false, lines: [], skipped: [] };
  const agentId = payload && payload.agent_id ? String(payload.agent_id) : '';
  if (!/^[A-Za-z0-9_-]+$/.test(agentId)) throw new Error('в событии нет пригодного agent_id');

  let file = payload.agent_transcript_path && fs.existsSync(payload.agent_transcript_path) ? payload.agent_transcript_path : null;
  if (!file) { const f = findTranscript(agentId, root, ENGINE_TAG); file = f ? f.file : null; }
  const call = file ? readCall(file) : null;

  const ledgerFile = path.join(ledgerDir(root), 'calls.jsonl');
  const prior = readLedger(ledgerFile).filter((r) => r.conversationId === agentId);
  const continuation = prior.length > 0;
  const cards = call ? cardsIn(call.prompt) : [];
  const nowIso = (opts.now || new Date()).toISOString();
  let meta = {};
  if (file) { try { meta = JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, '.meta.json'), 'utf8')); } catch {} }
  const agentType = payload.agent_type || meta.agentType || null;
  const node = nodeOf(agentType);

  const rec = {
    timestamp: nowIso, conversationId: agentId, engine: ENGINE_TAG, node: agentType,
    input_tokens: call ? call.tokens_in : null, output_tokens: call ? call.tokens_out : null,
    cache_read_tokens: call ? call.cache_read : null, cache_write_tokens: call ? call.cache_write : null,
    duration_s: call ? call.duration_s : null, cards,
  };
  if (continuation) {
    rec.continuation = true;
    const p = prior[prior.length - 1];
    const same = ['input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens'].every((k) => p[k] === rec[k]);
    if (same && call) { result.skipped.push('нет прироста против последней записи журнала'); return result; }
  }
  fs.mkdirSync(ledgerDir(root), { recursive: true });
  fs.appendFileSync(ledgerFile, JSON.stringify(rec) + '\n', 'utf8');
  result.recorded = true;

  // Карточки, которые нашлись на доске или в done/.
  const found = [];
  for (const num of cards) {
    const f = cardFiles(root, (n) => n.startsWith(`card-${num}-`) && n.endsWith('.md'))[0];
    if (f) found.push({ num, file: f });
    else result.skipped.push(`card-${num}: карточки нет на доске — только журнал`);
  }
  const total = call ? {
    tokens: call.tokens_in + call.cache_write + call.cache_read + call.tokens_out,
    cache_read: call.cache_read, tokens_out: call.tokens_out, duration_s: call.duration_s,
  } : { tokens: null, cache_read: null, tokens_out: null, duration_s: null };
  const K = found.length;
  found.forEach((c, idx) => {
    const share = K > 1 ? splitForBatch(total, K, idx + 1) : total;
    const text = fs.readFileSync(c.file, 'utf8');
    const acc = accountedInCard(text, agentId);
    let { tokens, cache_read: r, tokens_out: o, duration_s: s } = share;
    if (acc.lines) {
      if (!continuation) { result.skipped.push(`card-${c.num}: строка с этим call id уже есть`); return; }
      if (tokens == null || tokens - acc.tokens <= 0) { result.skipped.push(`card-${c.num}: нового расхода нет`); return; }
      const d = (v, a) => (v == null ? null : Math.max(0, v - a));
      tokens = d(tokens, acc.tokens); r = d(r, acc.cache); o = d(o, acc.out); s = d(s, acc.seconds);
    }
    const what = (meta.description || '').replace(/\s+/g, ' ').trim();
    const desc = (acc.lines ? 'продолжение вызова — ' : '') + 'автозапись хуком SubagentStop'
      + (what ? ` (${what.replace(/—/g, '-')})` : '') + (K > 1 ? ` (batch ${idx + 1}/${K})` : '') + '.'
      + (call ? '' : ' (стенограмма вызова не найдена: N, R, O, T неизвестны.)');
    const line = '- ' + formatSpendLine({
      node, date: nowIso.slice(0, 10), tokens, cache_read: r, tokens_out: o, duration_s: s,
      call_id: agentId, engine: ENGINE_TAG, desc,
    });
    const next = insertIntoHistory(text, line);
    if (next == null) { result.skipped.push(`card-${c.num}: нет зоны «История»`); return; }
    fs.writeFileSync(c.file, next, 'utf8');
    result.lines.push({ card: c.num, line });
  });
  return result;
}

module.exports = { record, readCall, nodeOf, cardsIn, accountedInCard, insertIntoHistory };

if (require.main === module) {
  const root = process.env.CLAUDE_LEDGER_ROOT || DEFAULT_ROOT;
  try {
    let raw = '';
    try { raw = fs.readFileSync(0, 'utf8'); } catch {}
    if (process.env.CLAUDE_LEDGER_DEBUG === '1') {
      try { fs.mkdirSync(ledgerDir(root), { recursive: true }); fs.writeFileSync(path.join(ledgerDir(root), 'raw-last.json'), raw, 'utf8'); } catch {}
    }
    const payload = JSON.parse(raw);
    const r = record(payload, { root });
    for (const s of r.skipped) process.stderr.write(`[ledger-recorder] ${s}\n`);
  } catch (e) {
    logError(root, e && e.message ? e.message : String(e));
  }
  process.exit(0);
}
