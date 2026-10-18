'use strict';

// Допустимые значения `status` карточки — ровно пять (AGENTS.md §7): backlog, todo, in-progress, review, done.
// `done/` хранит закрытые карточки, но множество значений то же самое — переезд файла в `done/` меняет
// только место на диске, не форму поля. Старые/чужие формы («in_progress», «completed») молча расходятся
// с реестром движка (kanban-markdown) и ломают счёт волн и закрытие `Core`.

const path = require('path');
const fs = require('fs');
const { cardFiles, field } = require('../../dashboard/lib/card.cjs');

const ALLOWED = ['backlog', 'todo', 'in-progress', 'review', 'done'];

function run({ root }) {
  const problems = [];
  for (const file of cardFiles(root)) {
    const status = field(fs.readFileSync(file, 'utf8'), 'status');
    if (!ALLOWED.includes(status)) {
      problems.push(`${path.basename(file)}: status "${status}" — допустимо только ${ALLOWED.join('/')}`);
    }
  }
  return problems;
}

module.exports = { id: 'status-values', since: null, run };
