'use strict';

/**
 * Вкладка «Документация» — две книги, структура каждой задаётся файлом `_toc.json`, не папками.
 * Формат TOC — `.forma/templates/README-toc.md` и `.forma/templates/toc.json` (образец без следов проекта).
 *
 * Книга «Документация проекта» (`project/docs/_toc.json`) — один язык, `title` строкой.
 * Книга «Мануал движка» (`.forma/manual/_toc.json`) — общий TOC на обе ветки `.forma/manual/en/` и `.forma/manual/ru/`
 * (дерево файлов идентично по контракту `.forma/manual/README.md`), `title` — `{en, ru}`.
 *
 * Битая ссылка TOC — не сообщение в данных, а брошенная ошибка с адресом пункта (`items[0].items[1].page`):
 * `node .forma/dashboard/generate.js` падает на ней явно, а не публикует дашборд с тихой дырой в содержании.
 */

const fs = require('fs');
const path = require('path');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Все .md-файлы под `base`, путь — относительно `base`, с прямым слэшем (сравнимо с `page` из TOC).
function walkMd(dir, base, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkMd(full, base, out);
    else if (name.endsWith('.md')) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

// Обходит дерево TOC, на каждом листе (есть `page`) зовёт walk.onLeaf(item, trail-заголовков, адрес-для-ошибки);
// walk.sourceLabel — имя файла TOC для сообщения об ошибке.
// Ни `page`, ни `items` на узле — сломанный пункт, адресом и падаем, это тоже «ссылка на несуществующее».
function walkToc(items, trail, addrPrefix, walk) {
  items.forEach((item, i) => {
    const addr = `${addrPrefix}[${i}]`;
    if (item.items) {
      walkToc(item.items, [...trail, item.title], addr + '.items', walk);
    } else if (item.page) {
      walk.onLeaf(item, trail, addr);
    } else {
      throw new Error(`${walk.sourceLabel} ${addr} — item has neither "page" nor "items"`);
    }
  });
}

function buildProjectBook(projectRoot) {
  const root = path.join(projectRoot, 'project', 'docs');
  const tocFile = path.join(root, '_toc.json');
  const id = 'project';
  const fallbackTitle = { key: 'docs.title.project' };
  if (!fs.existsSync(tocFile)) {
    return { id, title: fallbackTitle, toc: null, pages: {}, unlisted: [], error: 'project/docs/_toc.json not found' };
  }
  let toc;
  try { toc = readJson(tocFile); } catch (err) { throw new Error(`project/docs/_toc.json is not valid JSON: ${err.message}`); }

  const pages = {};
  const referenced = new Set();
  walkToc(toc.items || [], [], 'items', { sourceLabel: 'project/docs/_toc.json', onLeaf: (item, trail, addr) => {
    const file = path.join(root, item.page);
    if (!fs.existsSync(file)) throw new Error(`project/docs/_toc.json ${addr}.page — file not found: ${item.page}`);
    referenced.add(item.page);
    pages[item.page] = { page: item.page, title: item.title, breadcrumbs: [...trail, item.title], text: fs.readFileSync(file, 'utf8') };
  } });
  const all = walkMd(root, root, []);
  const unlisted = all.filter((p) => p !== '_toc.json' && !referenced.has(p));
  return { id, title: toc.title || fallbackTitle, toc, pages, unlisted };
}

function buildManualBook(projectRoot) {
  const root = path.join(projectRoot, '.forma/manual');
  const tocFile = path.join(root, '_toc.json');
  const id = '.forma/manual';
  const fallbackTitle = { key: 'docs.title.manual' };
  if (!fs.existsSync(tocFile)) {
    return { id, title: fallbackTitle, toc: null, pages: { en: {}, ru: {} }, unlisted: { en: [], ru: [] }, error: '.forma/manual/_toc.json not found' };
  }
  let toc;
  try { toc = readJson(tocFile); } catch (err) { throw new Error(`.forma/manual/_toc.json is not valid JSON: ${err.message}`); }

  const pages = { en: {}, ru: {} };
  const referenced = new Set();
  walkToc(toc.items || [], [], 'items', { sourceLabel: '.forma/manual/_toc.json', onLeaf: (item, trail, addr) => {
    referenced.add(item.page);
    for (const lang of ['en', 'ru']) {
      const file = path.join(root, lang, item.page);
      if (!fs.existsSync(file)) throw new Error(`.forma/manual/_toc.json ${addr}.page — file not found: ${lang}/${item.page}`);
      pages[lang][item.page] = { page: item.page, title: item.title, breadcrumbs: [...trail, item.title], text: fs.readFileSync(file, 'utf8') };
    }
  } });
  const unlisted = {};
  for (const lang of ['en', 'ru']) {
    const all = walkMd(path.join(root, lang), path.join(root, lang), []);
    unlisted[lang] = all.filter((p) => !referenced.has(p));
  }
  return { id, title: toc.title || fallbackTitle, toc, pages, unlisted };
}

function buildDocs(projectRoot) {
  return { books: [buildProjectBook(projectRoot), buildManualBook(projectRoot)] };
}

module.exports = { buildDocs };
