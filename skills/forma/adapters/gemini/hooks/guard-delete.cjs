#!/usr/bin/env node
'use strict';

/**
 * PreToolUse hook for Antigravity:
 * Reads JSON payload on stdin, checks toolCall against .forma/rules/guard-delete.cjs,
 * and outputs { decision: "deny" | "allow", reason?: string } on stdout.
 */

const fs = require('fs');
const path = require('path');
const { runGuard } = require('../../.forma/rules/guard-delete.cjs');

let inputData = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  let root = process.cwd();
  let decision = { decision: 'allow' };

  try {
    if (inputData.trim()) {
      const payload = JSON.parse(inputData);
      if (payload.workspacePaths && payload.workspacePaths.length > 0) {
        root = payload.workspacePaths[0];
      }
      const toolCall = payload.toolCall || {};
      const toolName = toolCall.name || '';
      const toolArgs = toolCall.args || {};

      decision = runGuard({ toolName, args: toolArgs, root });
    }
  } catch (err) {
    // Fail-safe: do not crash agent loop, log to stderr
    process.stderr.write(`[guard-delete error] ${err.message}\n`);
  }

  process.stdout.write(JSON.stringify(decision) + '\n');
});
