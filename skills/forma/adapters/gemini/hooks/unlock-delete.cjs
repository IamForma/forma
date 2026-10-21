#!/usr/bin/env node
'use strict';

/**
 * PreInvocation / UserPrompt hook for Antigravity:
 * Detects the secret code phrase «Отключи сенсорику» from user message,
 * and sets single-use unlock marker (.forma/.delete-unlock).
 */

const fs = require('fs');
const path = require('path');
const { unlockDeletion } = require('../../.forma/rules/guard-delete.cjs');

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

      let textToCheck = '';

      // 1. Direct prompt if passed in payload
      if (typeof payload.prompt === 'string') {
        textToCheck += payload.prompt + ' ';
      }
      if (typeof payload.userPrompt === 'string') {
        textToCheck += payload.userPrompt + ' ';
      }

      // 2. Or from transcript if transcriptPath provided
      if (payload.transcriptPath && fs.existsSync(payload.transcriptPath)) {
        try {
          const lines = fs.readFileSync(payload.transcriptPath, 'utf8').trim().split('\n');
          const lastLines = lines.slice(-5);
          for (const line of lastLines) {
            try {
              const obj = JSON.parse(line);
              if (obj.source === 'USER_EXPLICIT' || obj.type === 'USER_INPUT') {
                if (typeof obj.content === 'string') {
                  textToCheck += obj.content + ' ';
                }
              }
            } catch {}
          }
        } catch {}
      }

      // Check phrase
      if (/Отключи сенсорику/i.test(textToCheck)) {
        unlockDeletion(root);
      }
    }
  } catch (err) {
    process.stderr.write(`[unlock-delete error] ${err.message}\n`);
  }

  // PreInvocation expects JSON output, e.g. { injectSteps: [] }
  process.stdout.write(JSON.stringify({ injectSteps: [] }) + '\n');
});
