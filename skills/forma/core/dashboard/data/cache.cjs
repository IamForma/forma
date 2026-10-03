'use strict';

/**
 * Кэш дашборда — `.forma/dashboard/.cache/<имя>`: путь к файлу и чтение ведомостей, которые пишут отдельные скрипты.
 * Обход стенограмм стоит секунды и гигабайты, поэтому сборка данных только читает готовое.
 */

const path = require('path');
const { readJson } = require('../lib/fs.cjs');

/** Путь к файлу в кэше дашборда проекта. */
const cachePath = (projectRoot, name) => path.join(projectRoot, '.forma/dashboard', '.cache', name);

/** Возраст в часах по ISO-времени; времени нет — `null`. */
const hoursSince = (iso) => (iso ? (Date.now() - Date.parse(iso)) / 3600000 : null);

/**
 * Ведомость из кэша без служебных полей `omit` и с возрастом (`ageHours`): вчерашняя ведомость —
 * не то же, что сегодняшняя. Файла нет или он битый — `null`.
 */
function readStatement(projectRoot, name, omit) {
  const d = readJson(cachePath(projectRoot, name), null);
  if (d === null) return null;
  const rest = { ...d };
  for (const key of omit) delete rest[key];
  return { ...rest, ageHours: hoursSince(d.generatedAt) };
}

module.exports = { cachePath, hoursSince, readStatement };
