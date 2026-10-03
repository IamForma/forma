#!/usr/bin/env node
// Проверка перед выпуском: то, что уходит в релиз плагина, не должно содержать следов проекта (запрет 16:
// коды карточек, даты, имена сайтов — ни в файлах, ни в сообщениях коммитов) и следов порчи переезда
// (слово в прозе или часть чужого пути, превращённые в путь `.forma/…`), а тесты и линтер — быть зелёными.
//   node scripts/check-release.cjs [--no-tests]   — из корня клона протокола; код выхода 1 — выпуск нельзя
//   node scripts/check-release.cjs --traces        — только следы проекта в файлах (хук pre-commit клона)
//   node scripts/check-release.cjs --message <файл> — только следы проекта в сообщении коммита (хук commit-msg)
//   node scripts/check-release.cjs --prepush       — следы в файлах и в сообщениях неотправленных коммитов (хук pre-push)
// Его зовёт forma-commit.cjs --release до слияния dev → main; тот же сканер гоняет test/release-check.test.cjs.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { gitOut } = require('./lib/git.cjs');

const DIRS = 'board|dashboard|living|manual|protocol|skills|templates';
// Порча переезда: путь `.forma/…` посреди чужого пути или слова, двойной корень, ключ или притяжательная форма.
const RULES = [
  { id: 'mid-path', re: new RegExp(String.raw`[A-Za-z0-9_-]/\.forma/(${DIRS})\b`), why: 'слово стало путём внутри чужого пути/URL' },
  { id: 'double-root', re: /\.forma\/protocol\/\.forma\//, why: 'клон протокола переписан как проект: двойной корень' },
  { id: 'prose', re: new RegExp(String.raw`\.forma/(${DIRS})(?::|'s|/(?:tools|blocks|connectors)\b)`), why: 'слово в прозе стало путём' },
];
// Следы проекта. Заглушки тестов и схемных примеров — card-001…009, card-099, goal-00…09 — не след.
const TRACES = [
  { id: 'card-code', re: /\bcard-(?!00[1-9]\b|099\b)\d{3}\b/i, why: 'код карточки проекта' },
  { id: 'card-word', re: /(?:карточк\p{L}*|\bcard)\s*№?\s*\d{2,3}\b/iu, why: 'номер карточки проекта' },
  { id: 'goal-code', re: /\bgoal-[1-9]\d\b/i, why: 'код цели проекта' },
  { id: 'attempt', re: /попытк\p{L}*\s+\d|attempt\s+\d/iu, why: 'номер попытки по карточке' },
  { id: 'criterion', re: /критери\p{L}*\s+\d|criterion\s+\d/iu, why: 'пункт критерия карточки' },
  { id: 'site', re: /iamforma\.pro|yaforma/i, why: 'имя сайта или проекта' },
  { id: 'date', re: /\b20\d\d-\d\d-\d\d\b/, why: 'календарная дата', files: /^(?!test\/)/ },
];
const TEXT = /\.(md|json|cjs|js|sh|toml|html|css|txt|yml|yaml)$/i;
const SKIP = /(^|\/)(node_modules|archive)\//;
const SELF = /^(scripts\/check-release\.cjs|test\/release-check\.test\.cjs)$/;

function files(dir) {
  return gitOut(dir, 'ls-files', '-z').split('\0').filter((rel) => rel && TEXT.test(rel) && !SKIP.test(rel) && !SELF.test(rel));
}

function scan(dir, rules, skip) {
  const found = [];
  for (const rel of files(dir)) {
    if (skip && skip.test(rel)) continue;
    let text; try { text = fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { continue; }
    text.split(/\r?\n/).forEach((line, i) => {
      for (const r of rules) if ((!r.files || r.files.test(rel)) && r.re.test(line)) found.push({ file: rel, line: i + 1, rule: r.id, why: r.why, text: line.trim().slice(0, 140) });
    });
  }
  return found;
}

/** Следы порчи в отслеживаемых текстовых файлах клона `dir`: [{ file, line, rule, text }]. */
const scanCorruption = (dir) => scan(dir, RULES, /^test\//);

/** Следы проекта в отслеживаемых текстовых файлах клона `dir`: [{ file, line, rule, why, text }]. */
const scanTraces = (dir) => scan(dir, TRACES);

/** Следы проекта в сообщениях коммитов: [{ message, rule, why }]. Даты в сообщении допустимы. */
function scanMessages(messages) {
  const found = [];
  for (const m of messages) for (const r of TRACES) if (r.id !== 'date' && r.re.test(m)) found.push({ message: m.split('\n')[0].slice(0, 100), rule: r.id, why: r.why });
  return found;
}

function stopTraces(fileHits, msgHits) {
  console.error('СТОП: в протоколе следы проекта — в клоне только чистый код (запрет 16):');
  for (const b of fileHits.slice(0, 40)) console.error(`  ${b.file}:${b.line} [${b.rule}: ${b.why}] ${b.text}`);
  for (const b of msgHits) console.error(`  коммит «${b.message}» [${b.rule}: ${b.why}]`);
  process.exit(1);
}

function main() {
  const dir = path.join(__dirname, '..');
  const argv = process.argv.slice(2);
  if (argv.includes('--message')) {
    const bad = scanMessages([fs.readFileSync(argv[argv.indexOf('--message') + 1], 'utf8')]);
    if (bad.length) stopTraces([], bad);
    return;
  }
  const prepush = argv.includes('--prepush');
  if (prepush || argv.includes('--traces')) {
    const msgs = prepush
      ? gitOut(dir, 'log', '--format=%B%x1e', 'HEAD', '--not', '--remotes=origin').split('\x1e').map((m) => m.trim()).filter(Boolean) : [];
    const f = scanTraces(dir), m = scanMessages(msgs);
    if (f.length || m.length) stopTraces(f, m);
    console.log('✓ следов проекта нет');
    return;
  }
  const traces = scanTraces(dir);
  if (traces.length) stopTraces(traces, []);
  console.log('✓ следов проекта нет');
  const bad = scanCorruption(dir);
  if (bad.length) {
    console.error('СТОП: в выпуске следы порчи переезда (' + bad.length + '):');
    for (const b of bad.slice(0, 40)) console.error(`  ${b.file}:${b.line} [${b.rule}: ${b.why}] ${b.text}`);
    process.exit(1);
  }
  console.log('✓ следов порчи переезда нет');
  if (argv.includes('--no-tests')) return;
  for (const [label, args] of [['тесты', ['test']], ['линтер', ['run', 'lint']]]) {
    const r = spawnSync('npm', args, { cwd: dir, encoding: 'utf8', shell: true });
    if (r.status) { console.error(`СТОП: ${label} красные:\n` + (r.stdout + r.stderr).split(/\r?\n/).slice(-25).join('\n')); process.exit(1); }
    console.log('✓ ' + label + ' зелёные');
  }
}

if (require.main === module) main();
module.exports = { scanCorruption, RULES, scanTraces, scanMessages, TRACES };
