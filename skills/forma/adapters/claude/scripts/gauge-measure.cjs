#!/usr/bin/env node
'use strict';
// Measures a Gauge executor against closed cards (role actually used = ground truth).
//   node .claude/scripts/gauge-measure.cjs prepare <outDir> [--dir cardsDir ...]
//     -> <outDir>/catalog.md, <outDir>/batch.json ([{id, task}]), <outDir>/truth.json ({id: role})
//   node .claude/scripts/gauge-measure.cjs score <outDir> <results.json>
//   node .claude/scripts/gauge-measure.cjs score <outDir> <results.json> --executor <name>   (name goes into the report line)
//     results.json: [{id, choice:{role,probabilities,confidence}, score:{clarity}, noul:{...}}]
// Tasks are scrubbed by gauge-scrub (prohibition 17); no value is printed.

const fs = require('fs');
const path = require('path');
const { extractTask, loadSecrets, scrub, residue } = require('./gauge-scrub.cjs');

const root = process.cwd();
const roleDir = path.join(root, '.claude', 'agents', 'run');

function catalog() {
  const out = [];
  for (const f of fs.readdirSync(roleDir).filter(n => n.endsWith('.md')).sort()) {
    const md = fs.readFileSync(path.join(roleDir, f), 'utf8');
    const name = f.replace(/\.md$/, '');
    const desc = (/^description:\s*(.+)$/m.exec(md) || [])[1] || '';
    const take = (/## When to take\s+([\s\S]*?)\n## /.exec(md) || [])[1] || '';
    const tdn = (/## Takes \/ does not take\s+([\s\S]*?)\n## /.exec(md) || [])[1] || '';
    out.push(`### ${name}\n${desc}\n${take.trim()}\n${tdn.trim()}\n`);
  }
  return out.join('\n');
}

function prepare(outDir, dirs) {
  fs.mkdirSync(outDir, { recursive: true });
  const siteHosts = new Set();
  const secrets = loadSecrets(root, siteHosts);
  const batch = [], truth = {}, refused = [];
  for (const d of dirs) {
    for (const f of fs.readdirSync(d).filter(n => /^card-\d+.*\.md$/.test(n))) {
      const md = fs.readFileSync(path.join(d, f), 'utf8');
      const role = (/(?:Роль|Role):\s*`([\w-]+)`/.exec(md) || [])[1];
      const task = extractTask(md);
      if (!role || !task) continue;
      const id = f.slice(0, 8);
      const { text } = scrub(task, secrets, siteHosts);
      if (residue(text, secrets).length) { refused.push(id); continue; }
      batch.push({ id, task: text.slice(0, 3000) });
      truth[id] = role;
    }
  }
  fs.writeFileSync(path.join(outDir, 'catalog.md'), catalog());
  fs.writeFileSync(path.join(outDir, 'batch.json'), JSON.stringify(batch, null, 1));
  fs.writeFileSync(path.join(outDir, 'truth.json'), JSON.stringify(truth, null, 1));
  console.log(`prepared ${batch.length} cards, refused by scrubbing: ${refused.length}`);
}

function score(outDir, resultsFile, executor) {
  const truth = JSON.parse(fs.readFileSync(path.join(outDir, 'truth.json'), 'utf8'));
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  let hit = 0, n = 0, confHit = 0, confN = 0; const miss = [];
  for (const r of results) {
    if (!(r.id in truth)) continue;
    n++;
    const role = r.choice && r.choice.role, conf = r.choice && r.choice.confidence;
    if (role === truth[r.id]) hit++; else miss.push(`${r.id}: truth ${truth[r.id]} / gauge ${role} (${conf})`);
    if (conf >= 80) { confN++; if (role === truth[r.id]) confHit++; }
  }
  if (executor) console.log(`executor: ${executor}`);
  console.log(`match ${hit}/${n} = ${(100 * hit / n).toFixed(0)} %`);
  console.log(`at confidence >= 80: ${confHit}/${confN}${confN ? ` = ${(100 * confHit / confN).toFixed(0)} %` : ''}`);
  console.log(miss.join('\n'));
}

const [cmd, a, b, ...rest] = process.argv.slice(2);
if (cmd === 'prepare') {
  const dirs = [b, ...rest].filter(x => x && x !== '--dir');
  prepare(a, dirs.length ? dirs : [path.join(root, '.devtool', 'features', 'done')]);
} else if (cmd === 'score') { const i = rest.indexOf('--executor'); score(a, b, i >= 0 ? rest[i + 1] : null); }
else { console.error('usage: gauge-measure.cjs prepare <outDir> [dirs…] | score <outDir> <results.json> [--executor <name>]'); process.exit(1); }
