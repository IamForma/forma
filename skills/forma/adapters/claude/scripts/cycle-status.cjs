#!/usr/bin/env node
// Счёт круга по эпикам (AGENTS.md §3, §7).
// Круг идёт внутри эпика: `Core` закрывает его, когда принятых карточек эпика (done + assignee "Core")
// набралось «объём круга» (PROJECT.md), по команде человека или по сроку. Выпуск протокола (dev → main,
// версия, push) — по объёму выпуска или на закрытии круга.
//   node .claude/scripts/cycle-status.cjs          — строка отчёта: «Форма 7/10 · … · протокол: K/N коммитов в dev до выпуска»
//   node .claude/scripts/cycle-status.cjs --json   — то же данными
// Только чтение. Выход всегда 0.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const { readIfExists, projectFile } = require('../../.forma/dashboard/lib/fs.cjs');
const { cardFiles, frontmatterBlock } = require('../../.forma/dashboard/lib/card.cjs');

const pm = readIfExists(projectFile(ROOT, 'PROJECT.md'));
const vm = pm.match(/^\|\s*Объём круга[^|]*\|\s*(\d+)/m) || pm.match(/^\|\s*Cycle volume[^|]*\|\s*(\d+)/m);
const volume = vm ? +vm[1] : null;
const rm = pm.match(/Выпуск протокола[^\n]*?(\d+)\s*$/m);
const release = rm ? +rm[1] : 10;

const perEpic = new Map();
for (const file of cardFiles(ROOT)) {
  const fm = frontmatterBlock(fs.readFileSync(file, 'utf8')) || '';
  const epic = (fm.match(/^epic:\s*"(.+?)"/m) || [])[1];
  if (!epic) continue;
  const status = (fm.match(/^status:\s*"(.+?)"/m) || [])[1];
  const assignee = (fm.match(/^assignee:\s*"?(.+?)"?\s*$/m) || [])[1];
  if (status === 'done' && assignee === 'Core') perEpic.set(epic, (perEpic.get(epic) || 0) + 1);
}

let ahead = null;
const proto = path.join(ROOT, '.forma/protocol');
if (fs.existsSync(path.join(proto, '.git'))) {
  // коммиты в dev, ещё не выпущенные в main; ветки dev нет — прежний счёт против upstream
  const cnt = (range, ...o) => +execFileSync('git', ['-C', proto, 'rev-list', '--count', ...o, range], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try { ahead = cnt('main..dev', '--no-merges'); } catch { try { ahead = cnt('@{u}..HEAD'); } catch { /* нет ветки dev и upstream — счётчик остаётся прежним */ } }
}

const epics = [...perEpic].map(([epic, accepted]) => ({ epic, accepted, full: volume != null && accepted >= volume }));
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ volume, epics, protocolAhead: ahead, releaseVolume: release }) + '\n');
  process.exit(0);
}
const parts = epics.map((e) => `${e.epic.replace(/\/.*$/, '')} ${e.accepted}/${volume ?? '?'}${e.full ? ' — пора Core' : ''}`);
if (ahead) parts.push(`протокол: ${ahead}/${release} коммитов в dev до выпуска — выпуск по объёму или на закрытии круга`);
if (parts.length) console.log('Круг по эпикам: ' + parts.join(' · '));
process.exit(0);
