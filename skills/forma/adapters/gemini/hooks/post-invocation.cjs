#!/usr/bin/env node
'use strict';

/**
 * PostInvocation hook for Antigravity:
 * Reads transcript.jsonl, identifies tool calls / subagent invocations,
 * and records raw entries into .agents/.ledger/calls.jsonl.
 */

const fs = require('fs');
const path = require('path');

let inputData = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  let root = process.cwd();

  try {
    if (inputData.trim()) {
      const payload = JSON.parse(inputData);
      if (payload.workspacePaths && payload.workspacePaths.length > 0) {
        root = payload.workspacePaths[0];
      }

      const ledgerDir = path.join(root, '.agents', '.ledger');
      fs.mkdirSync(ledgerDir, { recursive: true });
      const ledgerFile = path.join(ledgerDir, 'calls.jsonl');

      // Если передан transcriptPath, сканируем новые шаги
      if (payload.transcriptPath && fs.existsSync(payload.transcriptPath)) {
        recordFromTranscript(payload.transcriptPath, ledgerFile, payload.conversationId);
      }
    }
  } catch (err) {
    process.stderr.write(`[post-invocation error] ${err.message}\n`);
  }

  // PostInvocation output contract
  process.stdout.write(JSON.stringify({ injectSteps: [] }) + '\n');
});

function recordFromTranscript(transcriptPath, ledgerFile, conversationId) {
  const content = fs.readFileSync(transcriptPath, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);

  // Считываем уже записанные шаги
  const seenKeys = new Set();
  if (fs.existsSync(ledgerFile)) {
    const existing = fs.readFileSync(ledgerFile, 'utf8').trim().split('\n').filter(Boolean);
    for (const line of existing) {
      try {
        const obj = JSON.parse(line);
        seenKeys.add(`${obj.conversationId || ''}:${obj.step_index}`);
      } catch {}
    }
  }

  const newRecords = [];

  for (const line of lines) {
    try {
      const step = JSON.parse(line);
      const key = `${conversationId || ''}:${step.step_index}`;
      if (seenKeys.has(key)) continue;

      // Интересуют вызовы invoke_subagent или ответы модели с метриками токенов
      let hasSubagent = false;
      let subagentCall = null;

      if (step.tool_calls && Array.isArray(step.tool_calls)) {
        for (const tc of step.tool_calls) {
          if (tc.name === 'invoke_subagent') {
            hasSubagent = true;
            subagentCall = tc;
            break;
          }
        }
      }

      if (hasSubagent) {
        const record = {
          timestamp: step.created_at || new Date().toISOString(),
          conversationId: conversationId || null,
          step_index: step.step_index,
          type: step.type,
          engine: 'gemini',
          input_tokens: step.input_tokens ?? null,
          cache_read_tokens: step.cache_read_tokens ?? null,
          output_tokens: step.output_tokens ?? null,
          subagentCall: subagentCall ? {
            name: subagentCall.args?.TypeName || subagentCall.args?.Role,
            role: subagentCall.args?.Role,
            promptSnippet: (subagentCall.args?.Prompt || '').slice(0, 200),
          } : null,
        };

        newRecords.push(JSON.stringify(record));
        seenKeys.add(key);
      }
    } catch {}
  }

  if (newRecords.length > 0) {
    fs.appendFileSync(ledgerFile, newRecords.join('\n') + '\n', 'utf8');
  }
}

module.exports = { recordFromTranscript };
