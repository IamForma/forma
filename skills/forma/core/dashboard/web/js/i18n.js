// Локализация интерфейса. Один файл на браузер и на сервер: ядро (`format`, `pick`, `translate`) — чистые функции,
// их же берёт lib/i18n.cjs через require; браузерная часть (состояние, загрузка словарей, переключатель) — ниже.
// Словарь — плоский JSON `locales/<код>.json`; ключ `_meta.name` — название языка в списке. Значение — строка
// с подстановками `{имя}` либо объект форм числа `{one, few, many, other}` (выбор по `vars.n` через Intl.PluralRules).
// Нет ключа в выбранном языке — берётся en; нет и там — показывается сам ключ.
(function (root) {
  'use strict';
  const FALLBACK = 'en';

  function pick(entry, n, lang) {
    if (entry && typeof entry === 'object') {
      const form = new Intl.PluralRules(lang).select(Number(n) || 0);
      return entry[form] !== undefined ? entry[form] : (entry.other !== undefined ? entry.other : '');
    }
    return entry;
  }
  const format = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m));

  /** dicts: { en: {...}, <lang>: {...} }. */
  function translate(dicts, lang, key, vars) {
    const own = dicts[lang] || {}, fb = dicts[FALLBACK] || {};
    const entry = key in own ? own[key] : (key in fb ? fb[key] : undefined);
    if (entry === undefined) return key;
    return format(pick(entry, vars && vars.n, key in own ? lang : FALLBACK), vars);
  }

  const core = { FALLBACK, pick, format, translate };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }

  // ---------- браузер ----------
  const STORE = 'forma.lang';
  const dicts = {};
  let lang = FALLBACK;
  let locales = [{ code: 'en', name: 'English' }, { code: 'ru', name: 'Русский' }]; // i18n-keep: родное имя языка

  const stored = () => { try { return localStorage.getItem(STORE); } catch { return null; } };
  const store = (code) => { try { localStorage.setItem(STORE, code); } catch { /* приватный режим — выбор не запоминается */ } };
  const loadDict = (code) => dicts[code] ? Promise.resolve() : fetch('locales/' + code + '.json')
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((d) => { dicts[code] = d; })
    .catch(() => { dicts[code] = {}; });

  /** Перевод ключа на выбранный язык; `vars` — подстановки, `vars.n` выбирает форму числа. */
  root.t = (key, vars) => translate(dicts, lang, key, vars);
  root.i18nLang = () => lang;

  /** Проставляет переводы на элементы с `data-i18n` (текст), `data-i18n-ph` (placeholder), `data-i18n-title` (title). */
  root.i18nApply = (scope) => {
    const el = scope || document;
    el.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = root.t(n.dataset.i18n); });
    el.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = root.t(n.dataset.i18nPh); });
    el.querySelectorAll('[data-i18n-title]').forEach((n) => { n.title = root.t(n.dataset.i18nTitle); });
    document.documentElement.lang = lang;
    document.title = root.t('app.title');
  };

  function renderSwitcher() {
    const sel = document.getElementById('lang');
    if (!sel) return;
    sel.innerHTML = locales.map((l) => `<option value="${l.code}"${l.code === lang ? ' selected' : ''}>${l.name}</option>`).join('');
    sel.title = root.t('lang.label');
    sel.onchange = () => root.i18nSet(sel.value);
  }

  /** Выбор языка: словарь грузится, выбор запоминается, страница перерисовывается событием `i18n`. */
  root.i18nSet = (code) => loadDict(code).then(() => {
    lang = code;
    store(code);
    root.i18nApply();
    renderSwitcher();
    document.dispatchEvent(new CustomEvent('i18n', { detail: code }));
  });

  /** Старт: список языков с сервера (нет сервера — en и ru), en как запасной, язык из localStorage, иначе en. */
  root.i18nInit = () => fetch('locales.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((j) => { if (j && Array.isArray(j.locales) && j.locales.length) locales = j.locales; })
    .then(() => loadDict(FALLBACK))
    .then(() => { const s = stored(); return root.i18nSet(locales.some((l) => l.code === s) ? s : FALLBACK); });
})(typeof window !== 'undefined' ? window : globalThis);
