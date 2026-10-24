#!/usr/bin/env node
'use strict';

/**
 * .agents/scripts/plumb-run.cjs — Форвардер Plumb-драйвера внешнего исполнителя для Gemini.
 * Делегирует исполнение общему драйверу .forma/plumb/plumb-run.cjs,
 * передавая каталог профилей ролей Gemini (.agents/plugins/forma/agents/run).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const sharedPlumb = path.join(root, '.forma', 'plumb', 'plumb-run.cjs');
const geminiRolesDir = path.join(root, '.agents', 'plugins', 'forma', 'agents', 'run');

if (!fs.existsSync(sharedPlumb)) {
  console.error(`[plumb-gemini error] shared driver not found at ${sharedPlumb}`);
  process.exit(1);
}

const args = [sharedPlumb, ...process.argv.slice(2)];
if (!args.includes('--roles-dir')) {
  args.push('--roles-dir', geminiRolesDir);
}

const res = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: root });
process.exit(res.status ?? 0);
