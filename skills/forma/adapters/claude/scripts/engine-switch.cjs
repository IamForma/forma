#!/usr/bin/env node
'use strict';

// Включатель движков: реестр спящих `.forma/engines.json` (`{ "dormant": [...] }`).
//   node .claude/scripts/engine-switch.cjs status
//   node .claude/scripts/engine-switch.cjs sleep <движок>     — в реестр; движок не сверяется и не ставится
//   node .claude/scripts/engine-switch.cjs wake <движок>      — из реестра, пересборка данных движка, сверка
//   node .claude/scripts/engine-switch.cjs rebuild            — пересборка зеркал всех активных движков из .claude/; спящие не трогаются
// Пересборка (wake) у каждого движка своя — таблица REBUILD. Движка в таблице нет — только маркер и общая сверка.
// Реестр правится здесь, в проекте; в исходник протокола он уходит обычным forma-commit (engine-to-protocol, core/engines.json).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const REGISTRY = path.join(ROOT, '.forma', 'engines.json');
const ENGINES = ['claude', 'codex', 'gemini', 'minimax'];
const REBUILD = {
  gemini: [
    ['.claude/scripts/sync-engines.cjs', '--apply'], // зеркало ролей .agents/plugins/forma/agents/ заново из .claude/agents/
  ],
  codex: [
    ['.codex/scripts/sync-codex.cjs', '--apply'],   // роли и зеркало навыков заново из .claude/
    ['.codex/tests/test-sync-codex.cjs'],
  ],
  minimax: [
    ['.minimax/scripts/gen-roles.cjs'],           // роли .minimax/agents/ заново из .claude/agents/
    ['.minimax/scripts/gen-plugin-agents.cjs'],   // субагенты пакета miniapps/minimax-engine/ из .minimax/agents/
    ['.minimax/scripts/install-plugin.cjs'],      // пакет — в каталог данных MiniMax
    ['.minimax/tests/test-minimax-adapter.cjs'],
  ],
};

const read = () => { try { const l = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')).dormant; return Array.isArray(l) ? l : []; } catch { return []; } };
const write = (list) => fs.writeFileSync(REGISTRY, JSON.stringify({ dormant: list }, null, 2) + '\n');
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
const fail = (m) => { console.error('СТОП: ' + m); process.exit(1); };

// Шаги пересборки одного движка по таблице REBUILD: общий путь для wake и rebuild.
function rebuildEngine(id) {
  for (const step of REBUILD[id] || []) {
    if (!fs.existsSync(path.join(ROOT, step[0]))) fail(`нет ${step[0]} — установите адаптер ${id} (installer, когда ${id} разбужен в протоколе)`);
    const r = node(step);
    console.log(`${r.status === 0 ? '✓' : '✗'} ${step.join(' ')}`);
    if (r.status !== 0) { console.log(((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).slice(-8).join('\n')); fail(`пересборка ${id} не прошла — данные движка не обновлены`); }
  }
}

const [cmd, id] = process.argv.slice(2);
if (cmd === 'status' || !cmd) {
  const d = read();
  for (const e of ENGINES) console.log(`${e}: ${d.includes(e) ? 'спит' : 'активен'}`);
  process.exit(0);
}
if (cmd === 'rebuild') {
  const dormantList = read();
  const active = ENGINES.filter((e) => e !== 'claude' && !dormantList.includes(e));
  for (const e of active) rebuildEngine(e);
  const skipped = ENGINES.filter((e) => e !== 'claude' && dormantList.includes(e));
  console.log(`✓ пересобраны: ${active.join(', ') || 'нет активных'}${skipped.length ? '; спят, не тронуты: ' + skipped.join(', ') : ''}`);
  process.exit(0);
}
if (!['sleep', 'wake'].includes(cmd) || !ENGINES.includes(id)) fail('node .claude/scripts/engine-switch.cjs status | rebuild | sleep <движок> | wake <движок>; движки: ' + ENGINES.join(', '));
if (id === 'claude') fail('claude — основной движок, его не усыпляют');

const list = read();
if (cmd === 'sleep') {
  write([...new Set([...list, id])]);
  console.log(`✓ ${id}: спит (.forma/engines.json). Дальше: forma-commit с --release, чтобы реестр ушёл в протокол.`);
} else {
  write(list.filter((e) => e !== id));
  console.log(`✓ ${id}: маркер снят (.forma/engines.json)`);
  rebuildEngine(id);
}
const chk = node(['.claude/scripts/sync-engines.cjs', '--check']);
// Красное для движка — строки сверки об адаптерах и об этом движке; прочие находки (карточки, доска) к переключению не относятся.
const own = chk.stdout.split(/\r?\n/).filter((l) => /✗/.test(l) && new RegExp('адаптер|' + id, 'i').test(l));
const other = /^Сбой/m.test(chk.stdout);
console.log(own.length ? '✗ сверка движка красная:\n' + own.join('\n') : '✓ сверка движка зелёная');
if (other && !own.length) console.log('! в сверке есть прочие находки, к движку не относятся — node .claude/scripts/sync-engines.cjs --check');
process.exit(own.length ? 1 : 0);
