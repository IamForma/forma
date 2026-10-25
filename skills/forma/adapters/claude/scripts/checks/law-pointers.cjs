'use strict';

// Law pointers: every role or on-demand `*.md` file the law (`AGENTS.md`) names in backticks must exist in the
// engine's role directories and hold at least one `<!-- moved-from-law: <key> -->` block. A pointer to a missing
// file, or to a file that received nothing from the law, leaves a rule without a home.
// Not role files (never checked): names that carry a path (`VARS/credentials.md`, `.forma/...`), the root files
// of the protocol and the project, engine rules files (`claude-8.md` style: `<engine>-<digit>.md`).

const fs = require('fs');
const path = require('path');

const NOT_ROLE = new Set(['PROJECT.md', 'JOURNAL.md', 'GOAL.md', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md', 'README.md', 'ECONOMY.md', 'ROUTES.md']);

/** Bare `*.md` names in backticks, in the law text. */
function pointers(text) {
  const out = new Set();
  for (const m of text.matchAll(/`([^`\s\/]+\.md)`/g)) {
    const n = m[1];
    if (NOT_ROLE.has(n) || /^[a-z]+-\d+\.md$/.test(n)) continue;
    out.add(n);
  }
  return [...out].sort();
}

/** Problems for a law text against role directories (absolute paths). */
function verify(text, dirs) {
  const problems = [];
  for (const name of pointers(text)) {
    const dir = dirs.find((d) => fs.existsSync(path.join(d, name)));
    if (!dir) { problems.push(`указатель закона: \`${name}\` не найден в каталогах ролей`); continue; }
    if (!/<!--\s*moved-from-law:/.test(fs.readFileSync(path.join(dir, name), 'utf8'))) {
      problems.push(`указатель закона: \`${name}\` названа в AGENTS.md, но в файле нет маркера moved-from-law`);
    }
  }
  return problems;
}

function run({ root }) {
  const law = path.join(root, 'AGENTS.md');
  if (!fs.existsSync(law)) return [];
  const own = require('./support/engine-roots.cjs').own(root);
  if (!own) return [];
  const dirs = [own.src.rolesDir, own.src.onDemandRolesDir].filter(Boolean).map((d) => path.join(root, d));
  return verify(fs.readFileSync(law, 'utf8'), dirs);
}

module.exports = { id: 'law-pointers', since: null, run, verify, pointers };
