#!/usr/bin/env node
'use strict';

/**
 * PreToolUse hook for Antigravity:
 * Intercepts invoke_subagent for 'core', checks cycle accumulation via guard-core-cycle.cjs,
 * and outputs { decision: "deny" | "allow", reason?: string } on stdout.
 */

const fs = require('fs');
const path = require('path');

function resolveGuardModule() {
  const candidates = [
    path.resolve(__dirname, '../../.forma/rules/guard-core-cycle.cjs'),
    path.resolve(__dirname, '../../../core/rules/guard-core-cycle.cjs'),
    path.resolve(process.cwd(), '.forma/rules/guard-core-cycle.cjs'),
    path.resolve(process.cwd(), '.forma/protocol/skills/forma/core/rules/guard-core-cycle.cjs'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const { checkCoreCycleGuard } = require(resolveGuardModule());

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

      decision = checkCoreCycleGuard({ toolName, args: toolArgs, root });
    }
  } catch (err) {
    process.stderr.write(`[guard-core-cycle error] ${err.message}\n`);
  }

  process.stdout.write(JSON.stringify(decision) + '\n');
});
