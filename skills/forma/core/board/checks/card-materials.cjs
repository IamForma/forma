'use strict';

// Материалы карточек: project/cards/card-NNN/. Папка названа кодом карточки, а не заголовком, поэтому связь проверяема
// машиной. Ловим тихие поломки: папка осталась от удалённой карточки, карточка ссылается на папку, которой нет,
// файл в папке тяжелее потолка. Иначе они находятся случайно и поздно.

const fs = require('fs');
const path = require('path');
const { cardFiles, boardDir } = require('../../dashboard/lib/card.cjs');
const { walk } = require('../../dashboard/lib/fs.cjs');

// Потолок веса. 500 КБ — не бюджет места, а различитель рода: скриншот в него влезает, сгенерированный актив — нет.
// Значит файл тяжелее потолка почти всегда не доказательство, а актив, которому место у поставщика (project/cards/README.md).
// Проверка только называет: не жмёт, не удаляет, коммит не держит.
const LIMIT = 500 * 1024;
// assets/ и work/ — активы и рабочий материал скриптов: вне git (.gitignore), не взвешиваются.
const UNTRACKED = new Set(['assets', 'work']);

/** Коды существующих карточек — из имён файлов доски, живых и закрытых. */
function cardCodes(root) {
  const codes = new Set();
  for (const file of cardFiles(root, /^card-\d+-.*\.md$/)) codes.add(path.basename(file).match(/^(card-\d+)-/)[1]);
  return codes;
}

/** Папки материалов: имя — код карточки, карточка на доске есть, папка не пуста. */
function folderProblems(dir, codes) {
  const problems = [];
  if (!fs.existsSync(dir)) return problems;
  for (const entry of fs.readdirSync(dir)) {
    const abs = path.join(dir, entry);
    if (!fs.statSync(abs).isDirectory()) continue;
    const m = entry.match(/^(card-\d+)$/);
    if (!m) {
      problems.push(`project/cards/${entry}/: имя не код карточки — ожидается card-NNN`);
    } else if (!codes.has(m[1])) {
      problems.push(`project/cards/${entry}/: карточки с таким кодом на доске нет — ` +
                    'папка осталась от удалённой или код перепутан');
    } else if (!fs.readdirSync(abs).length) {
      problems.push(`project/cards/${entry}/: пусто — папка заводится, только когда есть что положить`);
    }
  }
  return problems;
}

/** Файлы материалов тяжелее потолка. */
function heavyProblems(dir) {
  const problems = [];
  if (!fs.existsSync(dir)) return problems;
  const files = walk(dir, { symlinks: true, skip: (e) => e.isDirectory() && UNTRACKED.has(e.name) });
  for (const rel of files) {
    const size = fs.statSync(path.join(dir, rel)).size;
    if (size > LIMIT) {
      problems.push(`project/cards/${rel}: ${Math.round(size / 1024)} КБ — тяжелее потолка в 500 КБ; ` +
                    'ужать, или это актив: у поставщика по ссылке либо в assets/ карточки (вне git)');
    }
  }
  return problems;
}

/** Обратная сторона: карточка ссылается на папку, которой нет. */
function danglingProblems(root, dir) {
  const problems = [];
  for (const file of cardFiles(root)) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(/project\/cards\/(card-\d+)\//g)) {
      if (!fs.existsSync(path.join(dir, m[1]))) problems.push(`${path.basename(file)}: ссылается на project/cards/${m[1]}/, которой нет`);
    }
  }
  return problems;
}

function run({ root }) {
  if (!fs.existsSync(boardDir(root))) return [];
  const dir = path.join(root, 'project', 'cards');
  return [...folderProblems(dir, cardCodes(root)), ...heavyProblems(dir), ...danglingProblems(root, dir)];
}

module.exports = { id: 'card-materials', since: null, run };
