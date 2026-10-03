'use strict';

/**
 * Журнал проверок проекта — `.forma/living/checks.json`: `{ "<правило>": "ГГГГ-ММ-ДД" }`, первый день, с которого правило
 * требуется. Движок знает только ключ правила; дату пишет проект. Часть общей библиотеки ядра (`.forma/dashboard/lib/`).
 */

const fs = require('fs');
const path = require('path');

/**
 * День, с которого действует правило. Правила нет в журнале — оно впервые встретилось в этом проекте:
 * записывается завтрашний день (строки, написанные сегодня, нового поля ещё не несут), и прошлое проекта
 * под проверку не попадает.
 */
function ruleSince(root, key) {
  const file = path.join(root, '.forma/living', 'checks.json');
  let j = {};
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* журнала проверок нет или он битый — начинаем с пустого */ }
  if (!j[key]) {
    j[key] = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n'); } catch { /* запись журнала не обязательна: дата уже вычислена и возвращается */ }
  }
  return j[key];
}

module.exports = { ruleSince };
