'use strict';

/**
 * Каталог маршрутов и надстроек — все коды из таблиц `.forma/manual/ru/03-forma/ROUTES.md`, не зашиты: «Движок»
 * показывает всё, что есть, а не только то, что используется. `DASH_ROUTES_FILE` — подмена источника для проверки.
 */

const path = require('path');
const { readIfExists } = require('../lib/fs.cjs');

const ROUTES_REL = '.forma/manual/ru/03-forma/ROUTES.md';
const RISK = ['Нельзя, когда', 'Риск', 'Почему осторожно', 'Защита от главного риска', 'Защита от устаревания'];
const WHY = ['Выбирать, когда', 'Почему работает', 'Почему'];
const SHORT = { 'Нельзя, когда': 'Нельзя', 'Выбирать, когда': 'Выбирать' };

const clean = (s) => s.replace(/`/g, '').replace(/\*\*/g, '').trim();

/** Подробные блоки §4–§5: «### `route-N` — …», строки «- **Метка:** текст». Нет строки — нет пункта. */
function parseDetails(text) {
  const details = {};
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^###\s+`((?:route|over)-\d+)`/);
    if (h) { cur = details[h[1]] = {}; continue; }
    if (/^#{1,3}\s/.test(line)) { cur = null; continue; }
    if (!cur || !/^- /.test(line)) continue;
    const b = line.match(/^- \*\*(.+?)\*\*\s*(.*)$/);
    if (b) cur[clean(b[1]).replace(/:$/, '')] = b[2].replace(/^:\s*/, '');
    else (cur._notes = cur._notes || []).push(clean(line.slice(2)));
  }
  return details;
}

function detailItems(d, keys) {
  const r = [];
  for (const k of keys) {
    if (d[k] == null) continue;
    const parts = d[k].split(/\*\*Защита:\*\*/);
    r.push({ label: SHORT[k] || k, text: clean(parts[0]) });
    if (parts[1] != null) r.push({ label: 'Защита', text: clean(parts[1]) });
  }
  return r;
}

/** Строки таблиц `route-N` и `over-N` с подробностями из блоков; результат дописывается в `out`. */
function addCatalogRows(text, details, out) {
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\|\s*`(route|over)-(\d+)`\s*\|/);
    if (!m) continue;
    const c = line.split('|').slice(1, -1).map(clean);
    const d = details[c[0]] || {};
    const risks = detailItems(d, RISK).concat((d._notes || []).map((t) => ({ label: 'См.', text: t })));
    const where = [{ label: 'Кратко', text: c[c.length - 1] }].concat(detailItems(d, WHY));
    if (m[1] === 'route') out.routes.push({ code: c[0], name: c[1], chain: c[2], risks, where });
    else out.overlays.push({ code: c[0], name: c[1], changes: c[2], risks, where });
  }
}

function readRoutesCatalog(projectRoot) {
  const file = process.env.DASH_ROUTES_FILE || path.join(projectRoot, ROUTES_REL);
  const out = { source: process.env.DASH_ROUTES_FILE ? file : ROUTES_REL, routes: [], overlays: [] };
  const text = readIfExists(file, null);
  if (text === null) { out.missing = true; return out; }
  addCatalogRows(text, parseDetails(text), out);
  return out;
}

module.exports = { readRoutesCatalog };
