'use strict';

// Размер файлов правил: платформа усекает файл правил сверх лимита (Antigravity — 24 000 байт), хвост закона теряется.
// Больше 22 000 байт — нарушение, больше 20 000 — сведение.

const fs = require('fs');
const path = require('path');

const ERROR_BYTES = 22000;
const WARN_BYTES = 20000;

function ruleFiles(root) {
  const files = ['AGENTS.md', 'GEMINI.md'];
  const E = require('../../../.forma/dashboard/lib/engines.cjs');
  const dirs = E.loadAdapters(root).map((a) => a.engineRulesFile).filter((f) => typeof f === 'string').map((f) => path.posix.dirname(f));
  for (const dir of [...new Set(dirs)]) {
    const abs = path.join(root, dir);
    if (fs.existsSync(abs)) for (const f of fs.readdirSync(abs)) if (f.endsWith('.md')) files.push(`${dir}/${f}`);
  }
  return files.filter((f) => fs.existsSync(path.join(root, f)));
}

function run({ root, info }) {
  const problems = [];
  for (const rel of ruleFiles(root)) {
    const bytes = fs.statSync(path.join(root, rel)).size;
    if (bytes > ERROR_BYTES) problems.push(`размер правил: ${rel} — ${bytes} байт, больше ${ERROR_BYTES}; платформа усечёт хвост — вынести в файл ролей по голому имени`);
    else if (bytes > WARN_BYTES && info) info.push(`  размер правил: ${rel} — больше ${WARN_BYTES} байт, близко к лимиту (${ERROR_BYTES})`);
  }
  return problems;
}

module.exports = { id: 'rules-size', since: null, run };
