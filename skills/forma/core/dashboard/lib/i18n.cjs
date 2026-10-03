'use strict';
// Локализация на стороне сервера: список языков из `locales/*.json` и перевод ключа. Ядро (подстановки, формы числа,
// запасной en) — то же, что в браузере: web/js/i18n.js, один файл на обе стороны.
const fs = require('fs');
const path = require('path');
const core = require('../web/js/i18n.js');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

function readDict(code, dir = LOCALES_DIR) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, code + '.json'), 'utf8')); } catch { return {}; }
}

/** [{ code, name }] — по файлу на язык; en первым, остальные по алфавиту кода. */
function listLocales(dir = LOCALES_DIR) {
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /^[a-z]{2,3}(-[A-Za-z0-9]+)?\.json$/.test(f)); } catch { /* нет каталога — пустой список */ }
  return files.map((f) => f.slice(0, -5)).sort((a, b) => (a === core.FALLBACK ? -1 : b === core.FALLBACK ? 1 : a.localeCompare(b)))
    .map((code) => ({ code, name: readDict(code, dir)['_meta.name'] || code }));
}

/** Перевод ключа на языке `lang` с запасным en. */
function tr(lang, key, vars, dir = LOCALES_DIR) {
  return core.translate({ [core.FALLBACK]: readDict(core.FALLBACK, dir), [lang]: readDict(lang, dir) }, lang, key, vars);
}

module.exports = { LOCALES_DIR, listLocales, readDict, tr, FALLBACK: core.FALLBACK, translate: core.translate };
