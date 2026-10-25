// Вкладка «Схема»: блоки движка карточками (название, задача, счётчики состава по типам); клик раскрывает файлы.
// Данные — d.schema (schema-view.cjs); списков блоков и файлов в вёрстке нет.
const SCHEMA_OPEN = new Set();
const scLang = () => (typeof i18nLang === 'function' ? i18nLang() : 'en');
const scPick = (o, base) => o[base + (scLang() === 'ru' ? 'Ru' : 'En')] || o[base + 'En'] || '';
function scCaller(f) {
  if (f.callerKind === 'link' || f.callerKind === 'reader') return `<code>${esc(f.caller)}</code>`;
  if (f.callerKind === 'entry' && f.entry) return esc(f.entry[scLang()] || f.entry.en || '');
  return `<span class="dim">${t('sc.callerNone')}</span>`;
}
function scFileRow(f) {
  const does = f.does ? esc(f.does) : `<span class="dim">${t('sc.noDoes')}</span>`;
  return `<li class="sc-file"><div class="sc-fh"><code>${esc(f.path)}</code><span class="sc-type sc-t-${esc(f.type)}">${t('sc.type.' + f.type)}</span></div>
    <div class="sc-does">${does}</div><div class="sc-caller"><span class="dim">${t('sc.caller')}:</span> ${scCaller(f)}</div></li>`;
}
function scBlockHtml(b, byPath, types) {
  const open = SCHEMA_OPEN.has(b.key);
  const chips = types.map((k) => `<span class="sc-chip sc-t-${esc(k)}${b.counts[k] ? '' : ' sc-zero'}" title="${esc(t('sc.type.' + k))}">${t('sc.type.' + k)} <b>${b.counts[k]}</b></span>`).join('');
  const rows = b.files.map((p) => byPath[p]).filter(Boolean).map(scFileRow).join('');
  return `<section class="sc-block${open ? ' sc-open' : ''}" data-block="${esc(b.key)}" id="sc-b-${esc(b.key)}">
    <button class="sc-head" data-sc-toggle="${esc(b.key)}" aria-expanded="${open}"><span class="sc-arrow">${open ? '▾' : '▸'}</span>
      <span class="sc-title">${esc(b[scLang()] || b.en)}</span><span class="sc-total">${t('sc.files', {n: b.files.length})}</span></button>
    <div class="sc-desc">${esc(scPick(b, 'desc'))}</div><div class="sc-chips">${chips}</div>
    <ul class="sc-list"${open ? '' : ' hidden'}>${rows}</ul></section>`;
}
function schemaHtml(s) {
  if (!s || !s.blocks) return `<section class="nodes-card"><h2>${t('sc.title')}</h2><div class="node-empty">${t('sc.none')}</div></section>`;
  const byPath = {}; for (const f of s.files) byPath[f.path] = f;
  const uns = s.unsorted && s.unsorted.length
    ? `<section class="nodes-card sc-unsorted"><h2>${t('sc.unsorted')} (${s.unsorted.length})</h2><ul>${s.unsorted.map((p) => `<li><code>${esc(p)}</code></li>`).join('')}</ul></section>` : '';
  return `<h2 class="st-h">${t('sc.title')}</h2><p class="dim">${t('sc.lede')}</p>
    <div class="sc-bar"><button id="sc-open">${t('sc.openAll')}</button><button id="sc-close">${t('sc.closeAll')}</button></div>
    <div class="sc-grid" id="sc-grid">${s.blocks.map((b) => scBlockHtml(b, byPath, s.types)).join('')}</div>${uns}`;
}
function scSet(block, open) {
  open ? SCHEMA_OPEN.add(block.dataset.block) : SCHEMA_OPEN.delete(block.dataset.block);
  block.classList.toggle('sc-open', open);
  block.querySelector('.sc-list').hidden = !open;
  block.querySelector('.sc-head').setAttribute('aria-expanded', String(open));
  block.querySelector('.sc-arrow').textContent = open ? '▾' : '▸';
  document.dispatchEvent(new CustomEvent('schema-layout'));
}
document.addEventListener('click', (e) => {
  const h = e.target.closest && e.target.closest('[data-sc-toggle]');
  if (h) { const b = h.closest('.sc-block'); scSet(b, !b.classList.contains('sc-open')); return; }
  if (e.target.id === 'sc-open' || e.target.id === 'sc-close')
    document.querySelectorAll('#sc-grid .sc-block').forEach((b) => scSet(b, e.target.id === 'sc-open'));
});
