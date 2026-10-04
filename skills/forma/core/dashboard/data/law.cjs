'use strict';

/**
 * Вкладка «Закон»: AGENTS.md, §8 движка, роли, маршруты, проект, проверки — текстом, как лежат в файлах.
 * Пути движка (роли, файл правил, скрипт сверки) называет адаптер через `lib/engines.cjs`; нет адаптера —
 * пустой текст и пустые списки, а не ошибка.
 */

const fs = require('fs');
const path = require('path');
const { readIfExists, projectFile } = require('../lib/fs.cjs');
const { parseFlatFrontmatter } = require('../lib/card.cjs');
const engines = require('../lib/engines.cjs');

/** Роли из каталога `dir` (относительно корня): имя, описание, модель, усилие, инструменты, тело. */
function readRoles(projectRoot, dir) {
  if (!dir || !fs.existsSync(path.join(projectRoot, dir))) return [];
  return fs.readdirSync(path.join(projectRoot, dir)).filter((f) => f.endsWith('.md')).map((f) => {
    const text = readIfExists(path.join(projectRoot, path.join(dir, f)));
    const [o, body] = parseFlatFrontmatter(text.replace(/\r/g, ''));
    return {
      file: dir + '/' + f, name: o.name || f.replace(/\.md$/, ''), desc: o.description || '',
      model: o.model || '', effort: o.effort || '', tools: o.tools || '', body,
    };
  });
}

/** Текст файла, который называет адаптер по полю `field`; нет адаптера или поля — пустая строка. */
function readEngineFile(projectRoot, field) {
  const rel = engines.first(projectRoot, field);
  return rel ? readIfExists(path.join(projectRoot, rel)) : '';
}

function buildLaw(projectRoot) {
  const rd = (f) => readIfExists(path.join(projectRoot, f));
  const syncScript = readEngineFile(projectRoot, 'syncScript');
  return {
    agents: rd('AGENTS.md'),
    engine: readEngineFile(projectRoot, 'engineRulesFile'),
    project: readIfExists(projectFile(projectRoot, 'PROJECT.md')),
    routes: rd('.forma/manual/ru/03-forma/ROUTES.md'),
    protocol: rd('.forma/manual/ru/03-forma/PROTOCOL.md'),
    roles: readRoles(projectRoot, engines.first(projectRoot, 'rolesDir')),
    onDemand: readRoles(projectRoot, engines.first(projectRoot, 'onDemandRolesDir')),
    checkDates: JSON.parse(rd('.forma/living/checks.json') || '{}'),
    checks: [...syncScript.matchAll(/^\/\/ --- (.+?) -*$/gm)].map((m) => m[1].trim()),
  };
}

module.exports = { buildLaw };
