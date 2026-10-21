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
function resolveLib(subpath) {
  const candidates = [
    path.resolve(__dirname, '../../.forma/dashboard/lib', subpath),
    path.resolve(__dirname, '../../../core/dashboard/lib', subpath),
    path.resolve(process.cwd(), '.forma/dashboard/lib', subpath),
    path.resolve(process.cwd(), '.forma/protocol/skills/forma/core/dashboard/lib', subpath),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const { readIfExists, projectFile } = require(resolveLib('fs.cjs'));
const { cardFiles, frontmatterBlock } = require(resolveLib('card.cjs'));

function parseVolume(text) {
  if (!text) return null;
  const vm = text.match(/<!--\s*k:volume\s*-->\s*\|\s*(\d+)/i) ||
             text.match(/^\|\s*(?:Объём\s*(?:круга|цикла)|Cycle volume)[^|]*\|\s*(\d+)/mi);
  return vm ? +vm[1] : null;
}

function getCycleStatus(root = ROOT) {
  const pm = readIfExists(projectFile(root, 'PROJECT.md'));
  const volume = parseVolume(pm);
  const rm = pm.match(/Выпуск протокола[^\n]*?(\d+)\s*$/m);
  const release = rm ? +rm[1] : 10;

  const perEpic = new Map();
  for (const file of cardFiles(root)) {
    const fm = frontmatterBlock(fs.readFileSync(file, 'utf8')) || '';
    const epic = (fm.match(/^epic:\s*"(.+?)"/m) || [])[1];
    if (!epic) continue;
    const status = (fm.match(/^status:\s*"(.+?)"/m) || [])[1];
    const assignee = (fm.match(/^assignee:\s*"?(.+?)"?\s*$/m) || [])[1];
    if (status === 'done' && assignee === 'Core') perEpic.set(epic, (perEpic.get(epic) || 0) + 1);
  }

  let ahead = null;
  const proto = path.join(root, '.forma/protocol');
  if (fs.existsSync(path.join(proto, '.git'))) {
    // коммиты в dev, ещё не выпущенные в main; ветки dev нет — прежний счёт против upstream
    const cnt = (range, ...o) => +execFileSync('git', ['-C', proto, 'rev-list', '--count', ...o, range], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    try { ahead = cnt('main..dev', '--no-merges'); } catch { try { ahead = cnt('@{u}..HEAD'); } catch { /* нет ветки dev и upstream — счётчик остаётся прежним */ } }
  }

  const epics = [...perEpic].map(([epic, accepted]) => ({ epic, accepted, full: volume != null && accepted >= volume }));
  return { volume, epics, protocolAhead: ahead, releaseVolume: release };
}

if (require.main === module) {
  const status = getCycleStatus(ROOT);
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(status) + '\n');
    process.exit(0);
  }
  const parts = status.epics.map((e) => `${e.epic.replace(/\/.*$/, '')} ${e.accepted}/${status.volume ?? '?'}${e.full ? ' — пора Core' : ''}`);
  if (status.protocolAhead) parts.push(`протокол: ${status.protocolAhead}/${status.releaseVolume} коммитов в dev до выпуска — выпуск по объёму или на закрытии круга`);
  if (parts.length) console.log('Круг по эпикам: ' + parts.join(' · '));
  process.exit(0);
}

module.exports = { parseVolume, getCycleStatus };
