'use strict';

// Адаптер Claude доставляет интервью ядра в .claude/skills/ копией и вызывает проверку доски ядра из хука.

const fs = require('fs');
const path = require('path');
const { walk } = require('../../../.forma/dashboard/lib/fs.cjs');

const INTERVIEW_SKILLS = ['grilling', 'forma-grill-with-ui'];

const readLf = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

/** Интервью `s`: копия в .claude/skills/ есть и совпадает с ядром (концы строк не в счёт). */
function skillProblems(root, s) {
  const src = path.join(root, '.forma/skills', s);
  const dst = path.join(root, '.claude', 'skills', s);
  if (!fs.existsSync(src)) return [];
  if (!fs.existsSync(dst)) return [`адаптер Claude Code: интервью ${s} не доставлено в .claude/skills/`];
  const a = walk(src).sort();
  const b = walk(dst).sort();
  const drift = a.join() !== b.join() || a.some((f) => readLf(path.join(src, f)) !== readLf(path.join(dst, f)));
  return drift ? [`адаптер Claude Code: .claude/skills/${s} разошлась с ядром .forma/skills/${s} — доставка копией из ядра`] : [];
}

function run({ root }) {
  if (!fs.existsSync(path.join(root, '.claude', 'rules', 'claude-8.md'))) return [];
  const problems = INTERVIEW_SKILLS.flatMap((s) => skillProblems(root, s));
  const hook = path.join(root, '.claude', 'hooks', 'check-card.sh');
  if (fs.existsSync(hook) && !fs.readFileSync(hook, 'utf8').includes('node .forma/board/check-board.cjs')) {
    problems.push('адаптер Claude Code: хук check-card.sh не вызывает проверку доски ядра .forma/board/check-board.cjs');
  }
  return problems;
}

module.exports = { id: 'claude-delivery', since: null, run };
