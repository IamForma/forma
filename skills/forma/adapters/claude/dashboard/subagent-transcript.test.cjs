#!/usr/bin/env node
'use strict';
// Каталог стенограмм берётся по тегу движка, не у первого адаптера.
const assert = require('assert');
const st = require('./subagent-transcript.cjs');
const root = require('path').resolve(__dirname, '..', '..');
const id = 'aa10026eb068cb82f';
(async () => {
  const dirs = st.transcriptDirs(root);
  assert.ok(Array.isArray(dirs));
  // Тег без каталога — null (маркер unknown у вызывающего), не ноль.
  assert.strictEqual(st.findTranscript(id, root, 'no-such-engine'), null);
  assert.strictEqual(await st.readSubagentTranscript(id, root, 'no-such-engine'), null);
  // Тег с каталогом и стенограммой — находит; иначе пропуск (машина без этой стенограммы).
  if (dirs.some((d) => d.tag === 'claude-code') && st.findTranscript(id, root, 'claude-code')) {
    const r = await st.readSubagentTranscript(id, root, 'claude-code');
    assert.ok(r && r.output > 0 && r.cacheRead > 0);
  }
  console.log('subagent-transcript.test: ok');
})().catch((e) => { console.error(e); process.exit(1); });
