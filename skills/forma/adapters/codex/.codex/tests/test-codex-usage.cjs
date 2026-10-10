#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '../..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'forma-codex-usage-'));
const usage = path.join(root, '.codex', 'scripts', 'codex-usage.cjs');
const transcript = path.join(fixture, 'child.jsonl');
const card = path.join(fixture, 'card.md');
const stamp = milliseconds => new Date(milliseconds).toISOString();
const t0 = stamp(0);
const t3 = stamp(3000);
const t4 = stamp(4000);
const t8 = stamp(8000);
const t9 = stamp(9000);
const day = t0.slice(0, 10);

function run(args) {
  return cp.spawnSync(process.execPath, [usage, ...args], { encoding: 'utf8' });
}

try {
  fs.writeFileSync(transcript, [
    JSON.stringify({ timestamp: t0, type: 'session_meta', payload: { id: 'usage-child-1', cwd: root, source: { subagent: { thread_spawn: { agent_role: 'run' } } } } }),
    JSON.stringify({ timestamp: t3, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 100, cached_input_tokens: 20 } } } }),
  ].join('\n') + '\n');
  fs.writeFileSync(card, '# fixture\n\n## History\n\n## Result\n');

  const normal = ['--file', transcript, '--complete', '--card', card];
  for (let i = 0; i < 2; i += 1) {
    const result = run(normal);
    if (result.status !== 0) throw new Error(`fresh usage fixture: ${result.stdout}${result.stderr}`);
  }
  fs.appendFileSync(transcript, JSON.stringify({ timestamp: t8, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 250, cached_input_tokens: 90 } } } }) + '\n');
  const normalAfterGrowth = run(normal);
  if (normalAfterGrowth.status !== 0) throw new Error(`grown normal usage fixture: ${normalAfterGrowth.stdout}${normalAfterGrowth.stderr}`);
  const continuation = ['--file', transcript, '--complete', '--continuation', '--after', t3, '--card', card];
  for (let i = 0; i < 2; i += 1) {
    const result = run(continuation);
    if (result.status !== 0) throw new Error(`continuation usage fixture: ${result.stdout}${result.stderr}`);
  }
  const missingBoundary = run(['--file', transcript, '--complete', '--continuation', '--card', card]);
  if (missingBoundary.status === 0) throw new Error('continuation usage fixture accepted no prior snapshot boundary');
  const unknownBoundary = run(['--file', transcript, '--complete', '--continuation', '--after', t4, '--card', card]);
  if (unknownBoundary.status === 0) throw new Error('continuation usage fixture accepted an unknown prior snapshot boundary');
  fs.appendFileSync(transcript, JSON.stringify({ timestamp: t9, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { total_tokens: 300, cached_input_tokens: 100 } } } }) + '\n');
  const overlappingBoundary = run(continuation);
  if (overlappingBoundary.status === 0) throw new Error('continuation usage fixture accepted an overlapping prior snapshot boundary');
  const normalAfterFurtherGrowth = run(normal);
  if (normalAfterFurtherGrowth.status !== 0) throw new Error(`further-grown normal usage fixture: ${normalAfterFurtherGrowth.stdout}${normalAfterFurtherGrowth.stderr}`);

  const batchCard = path.join(fixture, 'batch-card.md');
  fs.writeFileSync(batchCard, '# batch\n\n## History\n\n## Result\n');
  const batch = run(['--file', transcript, '--complete', '--card', batchCard, '--split', '3', '--share', '1', '--desc', 'kitted this card']);
  if (batch.status !== 0) throw new Error(`batch usage fixture: ${batch.stdout}${batch.stderr}`);
  const batchHistory = fs.readFileSync(batchCard, 'utf8');
  if (!batchHistory.includes(`\`Run\`, ${day}: attempt, 100 tokens (34 cache-read), 3 s, \`usage-child-1\` — codex: kitted this card (batch 1/3).`)) {
    throw new Error('batch usage fixture did not split measured N/R/T or mark the share');
  }

  const history = fs.readFileSync(card, 'utf8');
  if ((history.match(/attempt, 100 tokens/g) || []).length !== 1 || !history.includes(`\`Run\`, ${day}: attempt, 100 tokens (20 cache-read), 3 s, \`usage-child-1\` — codex: measured subagent transcript.`)) {
    throw new Error('fresh usage fixture did not retain the completed initial snapshot once');
  }
  if ((history.match(/attempt \(continuation\)/g) || []).length !== 1 || !history.includes(`\`Run\`, ${day}: attempt (continuation), 150 tokens (70 cache-read), 5 s, \`usage-child-1\` — codex: measured continuation segment.`) || !history.includes(`<!-- codex-usage-segment:usage-child-1:${encodeURIComponent(t3)}:${encodeURIComponent(t8)} -->`)) {
    throw new Error('continuation usage fixture did not subtract and deduplicate the named segment');
  }
  console.log('Codex usage fixtures verified: cumulative attachment, continuation delta, same-id segment idempotence, and required boundary.');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
