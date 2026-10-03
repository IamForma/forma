#!/usr/bin/env node
// Числа до/после переезда: карточки, страницы документации, скиллы, записи в корне.
// node layout-snapshot.cjs snapshot --root <dir> --out <file.json>
// node layout-snapshot.cjs diff <before.json> <after.json>
'use strict';
const fs = require('fs');
const path = require('path');
const { walk } = require('../../skills/forma/core/dashboard/lib/fs.cjs');

const HELP = `Применение:
  node layout-snapshot.cjs snapshot --root <dir> --out <file.json>   — посчитать и записать
  node layout-snapshot.cjs diff <before.json> <after.json>           — печатает разницу
  --help                                                              — эта справка
`;

function firstExisting(root, candidates) {
  for (const c of candidates) { const p = path.join(root, c); if (fs.existsSync(p)) return p; }
  return null;
}

function countMd(dir) { return dir ? walk(dir, { ext: '.md' }).length : 0; }

function snapshot(root) {
  const cardsDir = firstExisting(root, ['.devtool/features']);
  const docsDir = firstExisting(root, ['manual', '.forma/manual']);
  const skillsDir = firstExisting(root, ['skills', '.forma/skills']);
  const skills = skillsDir ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length : 0;
  const rootEntries = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.name !== '.git').length;
  return { timestamp: new Date().toISOString(), cards: countMd(cardsDir), docPages: countMd(docsDir), skills, rootEntries };
}

function diff(before, after) {
  const keys = ['cards', 'docPages', 'skills', 'rootEntries'];
  let changed = false;
  for (const k of keys) {
    const b = before[k], av = after[k];
    const mark = b === av ? '=' : (av > b ? '+' + (av - b) : String(av - b));
    if (b !== av) changed = true;
    console.log(k + ': ' + b + ' → ' + av + ' (' + mark + ')');
  }
  if (!changed) console.log('Без изменений.');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) { console.log(HELP); process.exit(argv.length === 0 ? 1 : 0); }
  const cmd = argv[0];
  if (cmd === 'snapshot') {
    let root = process.cwd(), out = null;
    for (let i = 1; i < argv.length; i++) {
      if (argv[i] === '--root') root = argv[++i];
      else if (argv[i] === '--out') out = argv[++i];
    }
    if (!out) { console.error('СТОП: нужен --out <file.json>.'); process.exit(2); }
    const snap = snapshot(path.resolve(root));
    fs.writeFileSync(out, JSON.stringify(snap, null, 2) + '\n', 'utf8');
    console.log('Записано: ' + out + ' — карточек ' + snap.cards + ', страниц документации ' + snap.docPages + ', скиллов ' + snap.skills + ', записей в корне ' + snap.rootEntries + '.');
  } else if (cmd === 'diff') {
    const [beforeFile, afterFile] = argv.slice(1);
    if (!beforeFile || !afterFile) { console.error('СТОП: нужны <before.json> <after.json>.'); process.exit(2); }
    diff(JSON.parse(fs.readFileSync(beforeFile, 'utf8')), JSON.parse(fs.readFileSync(afterFile, 'utf8')));
  } else { console.error('СТОП: неизвестная команда ' + cmd + ' (snapshot|diff).'); process.exit(2); }
}

main();
