'use strict';
// Start-up checks of a project, shared by every engine's session hook. They return message codes with
// parameters, not text: the caller renders them in the project language (`render`), English as the fallback.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const i18n = require('./index.cjs');

const exists = (root, rel) => fs.existsSync(path.join(root, rel));
/** Working project: files in the root; the protocol repository: under project/. */
const pick = (root, flat, nested) => (exists(root, flat) ? flat : nested);

const isEmptyCell = (v) => !v || i18n.phrases('unset').includes(String(v).toLowerCase());

function thresholdsIncomplete(reader) {
  const t = reader.table('thresholds');
  return !!t && t.rows.some((r) => isEmptyCell(r[1]));
}
function serviceLimitMissing(reader) {
  const t = reader.table('services');
  return !!t && t.rows.some((r) => !r[r.length - 1]);
}

/** Places a person should look at; never blocks. */
function readyNotes(root) {
  const out = [];
  const add = (code, params) => out.push({ code, params });
  const agents = path.join(root, '.claude', 'agents');
  if (fs.existsSync(agents)) {
    for (const a of ['intent', 'spec', 'kit', 'core']) if (!fs.existsSync(path.join(agents, a + '.md'))) add('ready.agents_missing_role', { name: a });
    if (!fs.readdirSync(agents).some((f) => /^run.*\.md$/.test(f))) add('ready.agents_no_executor');
  } else add('ready.agents_no_dir');

  const project = i18n.readProjectMd(root);
  if (project) {
    const reader = i18n.reader(project);
    if (thresholdsIncomplete(reader)) add('ready.thresholds_incomplete');
    const lang = reader.inline('language');
    if (!lang || /^(Documentation|Документация)/i.test(lang)) add('ready.language_unset');
  }

  const roadmap = pick(root, 'ROADMAP.md', 'project/ops/ROADMAP.md');
  if (!exists(root, roadmap)) add('ready.roadmap_missing');
  else if (i18n.phrases('roadmap_placeholder').some((p) => fs.readFileSync(path.join(root, roadmap), 'utf8').includes(p))) add('ready.roadmap_unfilled');

  if (!exists(root, pick(root, 'VARS', 'project/VARS'))) add('ready.vars_missing');

  const goals = pick(root, 'goals', 'project/goals');
  if (exists(root, goals)) {
    for (const d of fs.readdirSync(path.join(root, goals), { withFileTypes: true })) {
      if (d.isDirectory() && !exists(root, path.join(goals, d.name, 'GOAL.md'))) add('ready.goal_no_file', { dir: path.join(goals, d.name) + '/' });
    }
  }

  const sync = path.join(root, '.claude', 'scripts', 'sync-engines.cjs');
  if (fs.existsSync(sync) && spawnSync(process.execPath, [sync, '--quiet'], { cwd: root }).status !== 0) add('ready.parity_drift');
  return out;
}

/** Start stop (AGENTS.md §3): the human's goals and the thresholds; without them the cycle does not open. */
function startGate(root) {
  const out = [];
  const goals = pick(root, 'goals', 'project/goals');
  for (const c of ['result-image', 'review-image']) {
    const file = path.join(root, goals, `goal-${c}`, 'GOAL.md');
    if (!fs.existsSync(file) || /^draft:\s*true\s*$/m.test(fs.readFileSync(file, 'utf8'))) out.push({ code: 'gate.goal_not_formed', params: { goal: c } });
  }
  const reader = i18n.reader(i18n.readProjectMd(root));
  if (thresholdsIncomplete(reader)) out.push({ code: 'gate.thresholds' });
  if (exists(root, '.forma/translation-pending.json')) out.push({ code: 'gate.translation_pending' });
  if (serviceLimitMissing(reader)) out.push({ code: 'gate.service_limit' });
  return out;
}

/** Items → text in the project language; `''` when there is nothing to say. */
function render(root, items, headerCode, headerParams) {
  if (!items.length) return '';
  const lang = i18n.projectLang(root);
  const lines = items.map((it) => '  · ' + i18n.message(it.code, it.params, lang));
  return i18n.message(headerCode, headerParams || {}, lang) + '\n' + lines.join('\n') + '\n';
}

const readyText = (root) => { const n = readyNotes(root); return render(root, n, 'ready.notes_header', { n: n.length }); };
const gateText = (root) => render(root, startGate(root), 'gate.header');

module.exports = { readyNotes, startGate, readyText, gateText, render };
