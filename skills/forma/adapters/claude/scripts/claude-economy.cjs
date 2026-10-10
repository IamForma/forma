#!/usr/bin/env node
'use strict';

/**
 * Адаптер экономики Claude Code: транскрипт / результат вызова Claude → каноническая запись
 * (.forma/manual/en/03-forma/ECONOMY.md). Таблица «переменная → источник» — `.claude/agents/on-demand/spend-line.md`.
 *
 * Единственное место, где имена полей Claude (`input_tokens`, `subagent_tokens`, `duration_ms`…)
 * переводятся в канонические. Пользователи: subagent-transcript.cjs, card-session-spend.cjs,
 * session-economy.cjs; строку собирает .forma/dashboard/spend-line.cjs (`formatSpendLine`).
 *
 * Чего источник не дал — `null` (маркер `unknown`), никогда 0.
 *
 * CLI — строка расхода вызова субагента по его `<usage>`:
 *   node .claude/scripts/claude-economy.cjs line --node Run --agent-id <agent_id> \
 *     --tokens <subagent_tokens> --duration-ms <duration_ms> [--tool-uses <tool_uses>] \
 *     [--date YYYY-MM-DD] [--desc "<что сделано>"] [--split K --share I]
 *   R читается из стенограммы захода; нет стенограммы — `(cache-read unknown)` и причина в описании.
 *
 *   --split K --share I (1..K) — один вызов `Spec`/`Kit` снаряжает или режет K карточек разом
 *   (пакет, AGENTS.md §3, «Любой заход к субагенту привязан к карточке»): расход вызова делится
 *   на K карточек, не приписывается каждой целиком и не считается по ней в полном объёме (это и
 *   было бы двойным счётом при сложении по доске). Доля — целочисленная, без остатка: N (и R, и T)
 *   делятся на K, первые (N mod K) карточек получают на 1 больше — сумма долей по всем K карточкам
 *   равна исходному N/R/T без приближения. agent_id у всех K строк один и тот же (это один вызов,
 *   не K); `tally.cjs` не схлопывает их в дубль, потому что числа каждой строки свои — дедуп по
 *   [id, tokens, cache, seconds] расходится. Описание получает пометку `batch I/K`.
 */

const { formatSpendLine } = require('../../.forma/dashboard/spend-line.cjs');
const { makeCli } = require('../../.forma/dashboard/lib/cli.cjs');

const has = (o, k) => o != null && o[k] != null && Number.isFinite(Number(o[k]));
const pick = (o, k) => (has(o, k) ? Number(o[k]) : null);

/** Один шаг транскрипта: `message.usage` Claude → tokens_in, tokens_out, cache_read, cache_write. */
function claudeUsage(u) {
  return {
    tokens_in: pick(u, 'input_tokens'),
    tokens_out: pick(u, 'output_tokens'),
    cache_read: pick(u, 'cache_read_input_tokens'),
    cache_write: pick(u, 'cache_creation_input_tokens'),
  };
}

/**
 * Результат Agent-вызова (+ стенограмма, если есть) → каноническая запись строки карточки.
 * @param usage { agent_id, subagent_tokens|tokens, tool_uses, duration_ms }
 * @param transcript результат readSubagentTranscript или null
 */
function fromAgentResult(usage, transcript) {
  const u = usage || {};
  const tokens = pick(u, 'subagent_tokens') ?? pick(u, 'tokens');
  const ms = pick(u, 'duration_ms');
  const t = transcript || null;
  return {
    tokens,
    cache_read: t ? t.cacheRead : null,
    // В `<usage>` нет — только из стенограммы.
    cache_write: t ? t.cacheCreate : null,
    tokens_in: t ? t.input : null,
    tokens_out: t ? t.output : null,
    duration_s: ms == null ? null : Math.round(ms / 1000),
    call_id: u.agent_id ? String(u.agent_id) : null,
    tool_uses: pick(u, 'tool_uses'),
  };
}

/**
 * Доля карточки I (1..K) от общего количества `total`, целым числом, без остатка:
 * первые (total mod K) долей на 1 больше остальных — сумма всех K долей равна `total`.
 * `null`/`undefined` (unknown) остаётся как есть — делить нечего, доля тоже unknown.
 */
function batchShare(total, k, i) {
  if (total == null) return total;
  const base = Math.floor(total / k);
  const extra = total % k;
  return base + (i <= extra ? 1 : 0);
}

/** Запись вызова → запись одной из K карточек пакета (поля экономики делятся, call_id общий). */
function splitForBatch(rec, k, i) {
  return {
    ...rec,
    tokens: batchShare(rec.tokens, k, i),
    cache_read: batchShare(rec.cache_read, k, i),
    cache_write: batchShare(rec.cache_write, k, i),
    tokens_in: batchShare(rec.tokens_in, k, i),
    tokens_out: batchShare(rec.tokens_out, k, i),
    duration_s: batchShare(rec.duration_s, k, i),
  };
}

module.exports = { claudeUsage, fromAgentResult, batchShare, splitForBatch };

// ---- CLI ----
if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = makeCli(argv).value;
  if (argv[0] !== 'line' || !arg('node')) {
    console.error('usage: node .claude/scripts/claude-economy.cjs line --node <Node> --agent-id <id> --tokens <N> --duration-ms <ms> [--tool-uses <n>] [--date YYYY-MM-DD] [--desc "..."] [--split K --share I]');
    process.exit(2);
  }
  const { readSubagentTranscript, NO_TRANSCRIPT } = require('../../.forma/dashboard/subagent-transcript.cjs');
  (async () => {
    const id = arg('agent-id');
    const tr = id ? await readSubagentTranscript(id) : null;
    let rec = fromAgentResult({ agent_id: id, tokens: arg('tokens'), duration_ms: arg('duration-ms'), tool_uses: arg('tool-uses') }, tr);
    const k = arg('split'), i = arg('share');
    let batchNote = '';
    if (k != null) {
      if (i == null) { console.error('--split K требует --share I (1..K)'); process.exit(2); }
      rec = splitForBatch(rec, Number(k), Number(i));
      batchNote = ` (batch ${i}/${k})`;
    }
    const why = [];
    if (rec.cache_read == null) why.push(`R неизвестно: ${NO_TRANSCRIPT}`);
    if (rec.tokens == null) why.push('N не передан');
    if (rec.duration_s == null) why.push('T не передано');
    if (rec.call_id == null) why.push('id не передан');
    const desc = (arg('desc') || 'сделано.') + batchNote + (why.length ? ` (${why.join('; ')}.)` : '');
    console.log(formatSpendLine({
      node: arg('node'),
      date: arg('date') || new Date().toISOString().slice(0, 10),
      engine: 'claude-code',
      desc,
      ...rec,
    }));
  })();
}
