#!/usr/bin/env node
// Поиск корней через __dirname (`path.resolve(__dirname, '..')`, `path.join(__dirname, '..', '..')`)
// и расчёт новой глубины. Только отчёт — ничего не пишет.
'use strict';
const fs = require('fs');
const path = require('path');
const { listFiles, readTextOrNull } = require('./lib.cjs');

const HELP = `Применение: node layout-roots.cjs [--root <dir>] [--delta <N>] [файл-или-каталог ...]

  --root <dir>   корень для обхода по умолчанию (отслеживаемые git-файлы; по умолчанию текущий каталог)
  --delta <N>    на сколько уровней меняется глубина (целое, может быть отрицательным)
  файл/каталог   ограничить обход (иначе — всё дерево --root)
  --help         эта справка
`;

const CALL = /path\.(resolve|join)\(([^)]*)\)/g;

function countDots(argsText) {
  const parts = argsText.split(',').map((s) => s.trim());
  if (parts[0] !== '__dirname') return null;
  let n = 0;
  for (let i = 1; i < parts.length; i++) {
    const v = parts[i].replace(/^['"]|['"]$/g, '');
    if (v === '..') n++; else break; // считаем только ведущую цепочку '..'
  }
  return n;
}

function scanFile(abs, rel, report) {
  const text = readTextOrNull(abs);
  if (text == null) return;
  let m;
  CALL.lastIndex = 0;
  while ((m = CALL.exec(text))) {
    const n = countDots(m[2]);
    if (n == null) continue;
    const line = text.slice(0, m.index).split('\n').length;
    report.push({ rel, line, call: 'path.' + m[1] + '(__dirname, ...)', n });
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }
  let root = process.cwd(), delta = null;
  const targets = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--delta') delta = parseInt(argv[++i], 10);
    else targets.push(argv[i]);
  }
  root = path.resolve(root);
  const report = [];
  if (targets.length) {
    for (const t of targets) {
      const abs = path.resolve(t);
      if (fs.statSync(abs).isDirectory()) {
        for (const rel of listFiles(abs)) scanFile(path.join(abs, rel), path.relative(root, path.join(abs, rel)), report);
      } else scanFile(abs, path.relative(root, abs), report);
    }
  } else {
    for (const rel of listFiles(root)) scanFile(path.join(root, rel), rel, report);
  }
  if (!report.length) { console.log('Мест через __dirname не найдено.'); process.exit(0); }
  for (const r of report) {
    const suffix = delta == null ? '' : ' → новое число: ' + (r.n + delta);
    console.log(r.rel + ':' + r.line + ': ' + r.call + ' — ' + r.n + " '..'" + suffix);
  }
  console.log('Всего мест: ' + report.length + '.');
}

main();
