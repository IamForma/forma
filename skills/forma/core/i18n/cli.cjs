#!/usr/bin/env node
'use strict';
// Entry for shell hooks: `node .forma/i18n/cli.cjs <command> [--root <dir>]`
//   ready                 notes about unchecked places (empty output when everything is in place)
//   gate                  start stop (AGENTS.md §3); empty when the cycle may open
//   lang                  language code of the project documents (FORMA_LANG overrides)
//   msg <code> [k=v ...]  message in the project language, English as the fallback
//   hook-output <event> <user-code> <agent-code>   hook JSON: the details come from stdin, shown to the human and given to the agent
// The language of the text is the project's; the logic never depends on it.

const fs = require('node:fs');
const path = require('node:path');
const i18n = require('./index.cjs');
const checks = require('./project-checks.cjs');

const argv = process.argv.slice(2);
const at = argv.indexOf('--root');
const root = path.resolve(at >= 0 ? argv.splice(at, 2)[1] : (process.env.CLAUDE_PROJECT_DIR || process.cwd()));
const [cmd, ...rest] = argv;

if (cmd === 'ready') process.stdout.write(checks.readyText(root));
else if (cmd === 'gate') process.stdout.write(checks.gateText(root));
else if (cmd === 'lang') process.stdout.write(i18n.projectLang(root) + '\n');
else if (cmd === 'msg' && rest[0]) {
  const params = Object.fromEntries(rest.slice(1).map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  process.stdout.write(i18n.message(rest[0], params, i18n.projectLang(root)) + '\n');
} else if (cmd === 'hook-output' && rest.length === 3) {
  const lang = i18n.projectLang(root);
  const details = fs.readFileSync(0, 'utf8').replace(/\s+$/, '');
  process.stdout.write(JSON.stringify({
    systemMessage: i18n.message(rest[1], {}, lang) + '\n' + details,
    hookSpecificOutput: { hookEventName: rest[0], additionalContext: i18n.message(rest[2], {}, lang) + '\n' + details },
  }));
} else {
  process.stderr.write('usage: cli.cjs ready|gate|lang|msg <code> [k=v ...]|hook-output <event> <user-code> <agent-code> [--root <dir>]\n');
  process.exit(2);
}
