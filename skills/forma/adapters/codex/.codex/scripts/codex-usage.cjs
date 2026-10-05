#!/usr/bin/env node
'use strict';

/*
 * Measured Codex usage only.  A rollout transcript stores cumulative counters;
 * the final token_count is one session/call, so reading it once avoids counting
 * intermediate snapshots twice.  `--card` is deliberately explicit: only the
 * caller that knows the card may attach the returned subagent record to it.
 *
 *   node .codex/scripts/codex-usage.cjs --file <rollout.jsonl> --complete --card <card.md>
 *   node .codex/scripts/codex-usage.cjs --file <rollout.jsonl> --complete --continuation --after <prior-token-count-timestamp> --card <card.md>
 *   node .codex/scripts/codex-usage.cjs --report --write-cache
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const i18n = require(path.join(__dirname, '..', '..', '.forma', 'i18n', 'index.cjs'));

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const value = flag => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1] || null; };
const date = iso => String(iso || new Date().toISOString()).slice(0, 10);
const group = n => new Intl.NumberFormat('en-US').format(n).replace(/,/g, ' ');

async function readTranscript(file, continuationAfter = null) {
  let meta = null, metaAt = null, first = null, last = null, usage = null;
  const snapshots = [];
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('token_count') && !line.includes('session_meta')) continue;
    let row; try { row = JSON.parse(line); } catch { continue; }
    // A rolled-out child can embed its parent's metadata later in the file.
    // The first session_meta belongs to this transcript and is its attribution.
    if (row.type === 'session_meta' && !meta) { meta = row.payload || meta; metaAt = row.timestamp || meta?.timestamp || null; }
    if (row.type !== 'event_msg' || row.payload?.type !== 'token_count') continue;
    const totals = row.payload?.info?.total_token_usage;
    if (!totals || !Number.isFinite(totals.total_tokens)) continue;
    if (!first) first = row.timestamp;
    last = row.timestamp;
    usage = totals;
    snapshots.push({ timestamp: row.timestamp, usage: totals });
  }
  if (!usage) throw new Error('No measured total_token_usage in transcript: ' + file);
  let continuation = null;
  if (continuationAfter) {
    const prior = snapshots.find(snapshot => snapshot.timestamp === continuationAfter);
    if (!prior) throw new Error('Continuation boundary is not a token_count timestamp in transcript: ' + continuationAfter);
    if (prior === snapshots[snapshots.length - 1]) throw new Error('Continuation has no token_count after its boundary: ' + continuationAfter);
    const priorCache = Number.isFinite(prior.usage.cached_input_tokens) ? prior.usage.cached_input_tokens : null;
    const finalCache = Number.isFinite(usage.cached_input_tokens) ? usage.cached_input_tokens : null;
    if (usage.total_tokens < prior.usage.total_tokens || (priorCache != null && finalCache != null && finalCache < priorCache)) {
      throw new Error('Continuation counters decreased after boundary: ' + continuationAfter);
    }
    continuation = {
      after: continuationAfter,
      tokens: usage.total_tokens - prior.usage.total_tokens,
      cacheRead: priorCache == null || finalCache == null ? null : finalCache - priorCache,
      seconds: last ? Math.max(0, Math.round((Date.parse(last) - Date.parse(continuationAfter)) / 1000)) : null,
    };
  }
  const source = meta?.source?.subagent?.thread_spawn;
  const canonicalNode = { intent: 'Intent', spec: 'Spec', kit: 'Kit', run: 'Run', core: 'Core', extractor: 'Extractor' };
  const role = String(source?.agent_role || 'intent').toLowerCase();
  return {
    file, id: meta?.id || meta?.session_id || path.basename(file, '.jsonl'),
    cwd: meta?.cwd || null, node: canonicalNode[role] || source?.agent_role || 'Intent', kind: source ? 'subagent' : 'main',
    first: metaAt || first, last,
    tokens: continuation ? continuation.tokens : usage.total_tokens,
    cacheRead: continuation ? continuation.cacheRead : Number.isFinite(usage.cached_input_tokens) ? usage.cached_input_tokens : null,
    seconds: continuation ? continuation.seconds : metaAt && last ? Math.max(0, Math.round((Date.parse(last) - Date.parse(metaAt)) / 1000)) : null,
    continuation,
  };
}

function usageRoot() { return path.join(os.homedir(), '.codex', 'sessions'); }
function allJsonl(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? allJsonl(full) : e.isFile() && e.name.endsWith('.jsonl') ? [full] : [];
  });
}
function line(row) {
  const r = row.cacheRead == null ? '(cache-read unknown)' : `(${group(row.cacheRead)} cache-read)`;
  const s = row.seconds == null ? 'unknown' : String(row.seconds);
  const attempt = row.continuation ? 'attempt (continuation)' : 'attempt';
  return `- \`${row.node}\`, ${date(row.last || row.first)}: ${attempt}, ${group(row.tokens)} tokens ${r}, ${s} s, \`${row.id}\` — codex: measured ${row.continuation ? 'continuation segment' : row.kind + ' transcript'}.`;
}
function segmentMarker(row) {
  if (!row.last) return null;
  const id = encodeURIComponent(row.id);
  const from = encodeURIComponent(row.continuation ? row.continuation.after : 'initial');
  const to = encodeURIComponent(row.last);
  return `<!-- codex-usage-segment:${id}:${from}:${to} -->`;
}
function segments(body, id) {
  const encodedId = encodeURIComponent(id);
  return [...body.matchAll(/<!-- codex-usage-segment:([^:]+):([^:]+):([^ ]+) -->/g)]
    .filter(match => match[1] === encodedId)
    .map(match => ({ from: decodeURIComponent(match[2]), to: decodeURIComponent(match[3]), marker: match[0] }));
}
function append(card, row) {
  let body = fs.readFileSync(card, 'utf8');
  const segment = segmentMarker(row);
  if (!row.continuation && body.includes('`' + row.id + '`')) return false;
  if (row.continuation && segment && body.includes(segment)) return false;
  if (row.continuation) {
    const previous = segments(body, row.id).at(-1);
    if (!previous || previous.to !== row.continuation.after) {
      throw new Error('Continuation boundary is not the final recorded segment for this call id on the card: ' + row.continuation.after);
    }
  }
  const marker = i18n.headingRe('zone.result');
  const at = body.search(marker);
  if (at < 0) throw new Error('Card has no Result section: ' + card);
  body = body.slice(0, at).replace(/\s*$/, '\n') + line(row) + (segment ? ` ${segment}` : '') + '\n\n' + body.slice(at);
  fs.writeFileSync(card, body);
  return true;
}

(async () => {
  if (args.includes('--report')) {
    const rows = [];
    const sameProject = p => String(p || '').replace(/\\/g, '/').toLowerCase() === ROOT.replace(/\\/g, '/').toLowerCase();
    for (const file of allJsonl(usageRoot())) { try { const row = await readTranscript(file); if (sameProject(row.cwd)) rows.push(row); } catch {} }
    const byKind = Object.fromEntries(['main', 'subagent'].map(kind => [kind, rows.filter(r => r.kind === kind).reduce((a, r) => ({ calls: a.calls + 1, tokens: a.tokens + r.tokens, cacheRead: a.cacheRead + (r.cacheRead || 0), cacheKnown: a.cacheKnown + Number(r.cacheRead != null) }), { calls: 0, tokens: 0, cacheRead: 0, cacheKnown: 0 })]));
    const report = { generatedAt: new Date().toISOString(), source: usageRoot(), project: ROOT, attribution: 'unassigned until --card explicitly attaches a transcript id', sessions: rows, byKind };
    if (args.includes('--write-cache')) { const out = path.join(ROOT, '.forma', 'dashboard', '.cache', 'codex-usage.json'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }
  const file = value('--file');
  if (!file) throw new Error('Usage: --file <rollout.jsonl> [--card <card.md>], or --report');
  const continuation = args.includes('--continuation');
  const after = value('--after');
  if (continuation !== Boolean(after)) throw new Error('Continuation requires both --continuation and --after <prior-token-count-timestamp>.');
  if (continuation && !args.includes('--complete')) throw new Error('Continuation measurement requires --complete after the continued child has returned.');
  const row = await readTranscript(path.resolve(file), after);
  const card = value('--card');
  if (card && !args.includes('--complete')) throw new Error('Card attachment requires --complete after the caller has received the finished child turn.');
  if (card && row.kind !== 'subagent') throw new Error('Card attachment accepts a completed subagent transcript only; main Intent ↔ human belongs in the separate report.');
  const sameProject = p => String(p || '').replace(/\\/g, '/').toLowerCase() === ROOT.replace(/\\/g, '/').toLowerCase();
  if (card && !sameProject(row.cwd)) throw new Error('Card attachment rejects a transcript whose cwd is not this project.');
  const written = card ? append(path.resolve(card), row) : false;
  process.stdout.write(JSON.stringify({ ...row, spendLine: line(row), cardWritten: written }, null, 2) + '\n');
})().catch(error => { console.error(error.message); process.exit(1); });
