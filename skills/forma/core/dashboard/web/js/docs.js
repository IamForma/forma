// Вкладка «Документация»: две книги (`data/docs.cjs`), структура — из `_toc.json`, не из папок.
// Состояние (книга/язык/страница/поиск) живёт в `docsState`, переживает пересборку SSE: содержимое
// панели перерисовывается заново при каждом обновлении, а выбор человека — нет.

const docsState = { book: null, lang: 'ru', page: null, q: '' };

function docsTitleText(title, lang) {
  if (title && typeof title === 'object') return title[lang] || title.ru || title.en || '';
  return title == null ? '' : String(title);
}

function docsMd(t) {
  t = String(t || '').replace(/\r/g, '');
  if (window.marked) return marked.parse(t);
  return '<pre class="raw">' + esc(t) + '</pre>';
}

function docsFirstPage(toc) {
  for (const item of (toc && toc.items) || []) {
    if (item.page) return item.page;
    if (item.items) { const p = docsFirstPage(item); if (p) return p; }
  }
  return null;
}

function docsTocHtml(items, lang, current) {
  return `<ul class="doc-toc">${items.map((item) => {
    const t = docsTitleText(item.title, lang);
    if (item.items) return `<li class="doc-toc-group"><details open><summary>${esc(t)}</summary>${docsTocHtml(item.items, lang, current)}</details></li>`;
    const on = item.page === current ? ' on' : '';
    return `<li><a href="#" class="doc-link${on}" data-page="${esc(item.page)}">${esc(t)}</a></li>`;
  }).join('')}</ul>`;
}

function docsBookPages(book, lang) { return book.id === '.forma/manual' ? (book.pages[lang] || {}) : (book.pages || {}); }
function docsBookUnlisted(book, lang) { return book.id === '.forma/manual' ? ((book.unlisted || {})[lang] || []) : (book.unlisted || []); }

function docsSearchResults(pages, q, lang) {
  const needle = q.trim().toLowerCase();
  if (!needle) return null;
  return Object.values(pages)
    .filter((p) => (p.text || '').toLowerCase().includes(needle) || docsTitleText(p.title, lang).toLowerCase().includes(needle))
    .slice(0, 30);
}

function docsHtml(d) {
  const docs = d && d.docs;
  if (!docs || !docs.books || !docs.books.length) return `<div class="chain-clean">Данных нет.</div>`;
  if (!docsState.book) docsState.book = docs.books[0].id;
  const book = docs.books.find((b) => b.id === docsState.book) || docs.books[0];
  const isManual = book.id === '.forma/manual';
  const lang = isManual ? docsState.lang : null;

  const switcher = `<nav class="doc-books">${docs.books.map((b) => `<span class="tab ${b.id === book.id ? 'on' : ''}" data-doc-book="${b.id}">${esc(docsTitleText(b.title, 'ru'))}</span>`).join('')}
    ${isManual ? `<span class="doc-langs"><span class="tab ${lang === 'en' ? 'on' : ''}" data-doc-lang="en">EN</span><span class="tab ${lang === 'ru' ? 'on' : ''}" data-doc-lang="ru">RU</span></span>` : ''}</nav>`;

  if (book.error) return `${switcher}<div class="chain-clean">Ошибка сборки книги: ${esc(book.error)}</div>`;

  const pages = docsBookPages(book, lang);
  const unlisted = docsBookUnlisted(book, lang);
  if (!docsState.page || !pages[docsState.page]) docsState.page = docsFirstPage(book.toc);
  const current = pages[docsState.page];

  const results = docsSearchResults(pages, docsState.q, lang);
  const sidebar = `<aside class="doc-side">
    <input type="search" class="doc-search" placeholder="Искать в книге…" value="${esc(docsState.q)}">
    ${results
      ? `<div class="doc-results">${results.length ? results.map((p) => `<a href="#" class="doc-link" data-page="${esc(p.page)}">${esc(docsTitleText(p.title, lang))}</a>`).join('') : '<div class="doc-empty">Ничего не найдено.</div>'}</div>`
      : docsTocHtml((book.toc && book.toc.items) || [], lang, docsState.page)}
    ${unlisted.length ? `<details class="doc-unlisted"><summary>Не включены в содержание (${unlisted.length})</summary><ul>${unlisted.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details>` : ''}
  </aside>`;

  const crumbs = current ? `<nav class="doc-crumbs">${current.breadcrumbs.map((t) => esc(docsTitleText(t, lang))).join(' › ')}</nav>` : '';
  const body = current
    ? `${crumbs}<article class="doc-article md">${docsMd(current.text)}</article>`
    : `<div class="chain-clean">В содержании этой книги пока нет пунктов.</div>`;

  return `${switcher}<div class="doc-layout">${sidebar}<section class="doc-main">${body}</section></div>`;
}

// Делегирование — один раз на контейнер; его дети перезаписываются при каждой пересборке, сам узел — нет.
function docsBind() {
  const el = document.getElementById('docs');
  if (!el || el.dataset.bound) return;
  el.dataset.bound = '1';
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-doc-book]');
    if (b) { docsState.book = b.dataset.docBook; docsState.page = null; docsState.q = ''; return docsRerender(); }
    const l = e.target.closest('[data-doc-lang]');
    if (l) { docsState.lang = l.dataset.docLang; return docsRerender(); }
    const p = e.target.closest('[data-page]');
    if (p) { e.preventDefault(); docsState.page = p.dataset.page; return docsRerender(); }
  });
  el.addEventListener('input', (e) => {
    if (e.target.classList.contains('doc-search')) { docsState.q = e.target.value; docsRerender(); }
  });
}

function docsRerender() {
  if (!latestData) return;
  document.getElementById('docs').innerHTML = docsHtml(latestData);
}
