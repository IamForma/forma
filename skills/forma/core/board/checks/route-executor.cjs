'use strict';

// Метка маршрута связывает исполнителя (AGENTS.md §2, §6). Маршруты, где работу делает `Run` (route-2, 5, 6, 7):
// карточка, дошедшая до проверки или принятая (`review`, `done`), несёт в истории хотя бы один заход `Run`.
// Иначе метка лжёт: работу вёл и принимал `Intent` (запрет 1). Исполнять самому — сменить метку с причиной в истории.

const fs = require('fs');
const path = require('path');
const { cardFiles, createdDay } = require('../../dashboard/lib/card.cjs');

const RUN_ROUTES = ['route-2', 'route-5', 'route-6', 'route-7'];
const RUN_ATTEMPT = /^-\s*`Run`,\s*\d{4}-\d{2}-\d{2}:\s*(attempt|заход)/m;

function cardProblem(f, text) {
  const status = (text.match(/^status:\s*"?([\w-]+)/m) || [])[1];
  if (status !== 'review' && status !== 'done') return null;
  const labels = (text.match(/^labels:\s*\[(.*)\]/m) || [])[1] || '';
  const route = RUN_ROUTES.find((r) => new RegExp('"' + r + '"').test(labels));
  if (!route || RUN_ATTEMPT.test(text)) return null;
  return `${f}: маршрут ${route} ведёт через \`Run\`, а в истории нет ни одного его захода — работу вёл другой узел; исполнять самому — сменить метку маршрута с причиной в истории`;
}

function run({ root, since }) {
  const problems = [];
  for (const file of cardFiles(root, /^card-\d+.*\.md$/)) {
    const text = fs.readFileSync(file, 'utf8');
    if (createdDay(text) < since) continue;
    const p = cardProblem(path.basename(file), text);
    if (p) problems.push(p);
  }
  return problems;
}

module.exports = { id: 'route-executor', since: 'route-executor', run };
