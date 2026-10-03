'use strict';

/**
 * Реестр проверок: одна проверка — один модуль `{ id, since, run(ctx) → находки }`. Часть общей библиотеки ядра
 * (`.forma/dashboard/lib/`); реестр — массив таких модулей в `index.cjs` рядом с ними, порядок массива — порядок находок.
 *
 *   id      имя проверки, латиница через дефис; совпадает с именем её файла
 *   since   ключ правила в `.forma/living/checks.json` или `null`, если правило не датировано. Ядро знает только ключ,
 *           день вступления пишет проект (`rules.ruleSince`)
 *   run     `run(ctx)` → массив строк-находок; пустой — проверка чиста. `ctx.root` — корень проекта,
 *           `ctx.since` — день вступления правила (`ГГГГ-ММ-ДД`) или `null`; прочие поля ctx проверки берут
 *           у запускающего (например, `ctx.info` — сведения, что не нарушения)
 */

const path = require('path');
const { spawnSync } = require('child_process');
const rules = require('./rules.cjs');

const ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Находки всех проверок реестра, склеенные в порядке реестра; день вступления каждой берётся из `.forma/living/checks.json`. */
function runChecks(checks, ctx) {
  return checks.flatMap((check) => {
    const since = check.since ? rules.ruleSince(ctx.root, check.since) : null;
    return check.run({ ...ctx, since });
  });
}

/** Что не так с реестром: пустой список — форма соблюдена (поля, тип `since`, уникальность `id`). */
function validateChecks(checks) {
  const problems = [];
  const seen = new Set();
  for (const check of checks) {
    const id = check && check.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) { problems.push(`id: «${id}» — ждали латиницу через дефис`); continue; }
    if (seen.has(id)) problems.push(`${id}: id встречается дважды`);
    seen.add(id);
    if (check.since !== null && typeof check.since !== 'string') problems.push(`${id}: since — ключ правила или null`);
    if (typeof check.run !== 'function') problems.push(`${id}: run — не функция`);
  }
  return problems;
}

/** Запуск файла-теста проверкой целостности: `null` — прошёл, иначе строка с кодом выхода и хвостом вывода. */
function runTestFile(root, rel) {
  const r = spawnSync(process.execPath, [path.join(root, rel)], { cwd: root, encoding: 'utf8' });
  const tail = (r.stderr || r.stdout || '').trim().split(String.fromCharCode(10)).pop().trim();
  return r.status === 0 ? null : `${rel}: тест не прошёл (код ${r.status}) — ${tail.slice(0, 160)}`;
}

module.exports = { runChecks, validateChecks, runTestFile };
