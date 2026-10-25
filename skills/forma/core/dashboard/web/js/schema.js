// Вкладка «Схема»: блоки движка карточками (название, задача, счётчики состава по типам); клик раскрывает файлы.
// Стрелки между блоками (читает, пишет, вызывает, регистрирует, порождает) — SVG поверх сетки, по d.schema.blockLinks.
// Данные — d.schema (schema-view.cjs); списков блоков, файлов и связей в вёрстке нет.
const SCHEMA_OPEN = new Set();
let SC_DATA = null; // последние данные схемы: стрелки считаются из них
const SC_HIDDEN = new Set(); // скрытые фильтром типы связей
let SC_SEL = ''; // выбранный блок: подсвечиваются его входящие и исходящие связи
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
  const open = SCHEMA_OPEN.has(b.key), sel = SC_SEL === b.key;
  const chips = types.map((k) => `<span class="sc-chip sc-t-${esc(k)}${b.counts[k] ? '' : ' sc-zero'}" title="${esc(t('sc.type.' + k))}">${t('sc.type.' + k)} <b>${b.counts[k]}</b></span>`).join('');
  const rows = b.files.map((p) => byPath[p]).filter(Boolean).map(scFileRow).join('');
  return `<section class="sc-block${open ? ' sc-open' : ''}${sel ? ' sc-sel' : ''}" data-block="${esc(b.key)}" id="sc-b-${esc(b.key)}">
    <button class="sc-pick${sel ? ' on' : ''}" data-sc-pick="${esc(b.key)}" title="${esc(t('sc.pick'))}" aria-pressed="${sel}">◎</button>
    <button class="sc-head" data-sc-toggle="${esc(b.key)}" aria-expanded="${open}"><span class="sc-arrow">${open ? '▾' : '▸'}</span>
      <span class="sc-title">${esc(b[scLang()] || b.en)}</span><span class="sc-total">${t('sc.files', {n: b.files.length})}</span></button>
    <div class="sc-desc">${esc(scPick(b, 'desc'))}</div><div class="sc-chips">${chips}</div>
    <ul class="sc-list"${open ? '' : ' hidden'}>${rows}</ul></section>`;
}
function scFilterHtml(s) {
  const chips = (s.linkTypes || []).map((k) => `<button class="sc-lt sc-l-${esc(k.key)}${SC_HIDDEN.has(k.key) ? ' off' : ''}" data-sc-type="${esc(k.key)}" aria-pressed="${!SC_HIDDEN.has(k.key)}"><svg width="30" height="10" aria-hidden="true"><line x1="1" y1="5" x2="29" y2="5"/></svg>${esc(k[scLang()] || k.en)}</button>`).join('');
  const opts = s.blocks.map((b) => `<option value="${esc(b.key)}"${SC_SEL === b.key ? ' selected' : ''}>${esc(b[scLang()] || b.en)}</option>`).join('');
  return `<div class="sc-filter"><span class="dim">${t('sc.linkTypes')}:</span>${chips}
    <label class="dim">${t('sc.blockFilter')}: <select id="sc-sel-block"><option value="">${t('sc.blockAll')}</option>${opts}</select></label></div>`;
}
function schemaHtml(s) {
  if (!s || !s.blocks) return `<section class="nodes-card"><h2>${t('sc.title')}</h2><div class="node-empty">${t('sc.none')}</div></section>`;
  SC_DATA = s;
  if (SC_SEL && !s.blocks.some((b) => b.key === SC_SEL)) SC_SEL = '';
  const byPath = {}; for (const f of s.files) byPath[f.path] = f;
  const uns = s.unsorted && s.unsorted.length
    ? `<section class="nodes-card sc-unsorted"><h2>${t('sc.unsorted')} (${s.unsorted.length})</h2><ul>${s.unsorted.map((p) => `<li><code>${esc(p)}</code></li>`).join('')}</ul></section>` : '';
  setTimeout(scRedraw, 0); // вёрстка ещё не вставлена в страницу — стрелки рисуются следом
  return `<h2 class="st-h">${t('sc.title')}</h2><p class="dim">${t('sc.lede')}</p>
    ${scFilterHtml(s)}
    <div class="sc-bar"><button id="sc-open">${t('sc.openAll')}</button><button id="sc-close">${t('sc.closeAll')}</button></div>
    <div class="sc-wrap" id="sc-wrap"><div class="sc-grid" id="sc-grid">${s.blocks.map((b) => scBlockHtml(b, byPath, s.types)).join('')}</div><svg class="sc-svg" id="sc-svg" aria-hidden="true"></svg></div>${uns}`;
}

// --- Стрелки ---
const SVGNS = 'http://www.w3.org/2000/svg';
const scEl = (name, attrs) => { const e = document.createElementNS(SVGNS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
/** Точка границы прямоугольника r на луче из его центра к (tx, ty). */
function scEdge(r, tx, ty) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const k = Math.min(dx ? (r.w / 2) / Math.abs(dx) : Infinity, dy ? (r.h / 2) / Math.abs(dy) : Infinity);
  return [cx + dx * k, cy + dy * k];
}
function scDraw() {
  const wrap = document.getElementById('sc-wrap'), svg = document.getElementById('sc-svg');
  if (!wrap || !svg || !SC_DATA || !SC_DATA.blockLinks) return;
  svg.replaceChildren();
  const W = wrap.offsetWidth, H = wrap.offsetHeight;
  if (!wrap.offsetParent || !W) return; // вкладка скрыта — размеров нет, перерисуется при показе
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const base = wrap.getBoundingClientRect(), rect = {};
  wrap.querySelectorAll('.sc-block').forEach((el) => {
    const r = el.getBoundingClientRect();
    rect[el.dataset.block] = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
  });
  const defs = scEl('defs', {});
  for (const k of SC_DATA.linkTypes) {
    const m = scEl('marker', { id: 'sc-m-' + k.key, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' });
    m.appendChild(scEl('path', { d: 'M0 0L10 5L0 10z', class: 'sc-mk sc-l-' + k.key }));
    defs.appendChild(m);
  }
  svg.appendChild(defs);
  const label = {}; for (const k of SC_DATA.linkTypes) label[k.key] = k[scLang()] || k.en;
  const links = SC_DATA.blockLinks.filter((l) => l.from !== l.to && rect[l.from] && rect[l.to] && !SC_HIDDEN.has(l.type));
  const groups = {}; // параллельные стрелки одной пары блоков разводятся в стороны
  for (const l of links) (groups[[l.from, l.to].sort().join('|')] ||= []).push(l);
  const drawn = [];
  for (const g of Object.values(groups)) g.forEach((l, i) => {
    const a = rect[l.from], b = rect[l.to];
    const ac = [a.x + a.w / 2, a.y + a.h / 2], bc = [b.x + b.w / 2, b.y + b.h / 2];
    const len = Math.hypot(bc[0] - ac[0], bc[1] - ac[1]) || 1;
    const sign = l.from < l.to ? 1 : -1, off = (i - (g.length - 1) / 2) * 14 * sign;
    const nx = -(bc[1] - ac[1]) / len * off, ny = (bc[0] - ac[0]) / len * off;
    const p1 = scEdge(a, bc[0] + nx, bc[1] + ny), p2 = scEdge(b, ac[0] + nx, ac[1] + ny);
    const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
    const hot = !SC_SEL || l.from === SC_SEL || l.to === SC_SEL;
    const grp = scEl('g', { class: 'sc-link sc-l-' + l.type + (SC_SEL ? (hot ? ' hot' : ' dim') : '') });
    grp.appendChild(scEl('line', { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), 'marker-end': `url(#sc-m-${l.type})` }));
    const tip = scEl('title', {}); tip.textContent = `${l.from} → ${l.to}: ${label[l.type]} (${l.count})`; grp.appendChild(tip);
    if (hot) {
      const tx = scEl('text', { x: ((x1 + x2) / 2).toFixed(1), y: ((y1 + y2) / 2 - 3).toFixed(1), 'text-anchor': 'middle' });
      tx.textContent = label[l.type]; grp.appendChild(tx);
    }
    drawn.push({ grp, hot: SC_SEL && hot });
  });
  drawn.sort((p, q) => (p.hot ? 1 : 0) - (q.hot ? 1 : 0)).forEach((d) => svg.appendChild(d.grp)); // подсвеченные — поверх
}
function scRedraw() { requestAnimationFrame(scDraw); }
function scSelect(key) {
  SC_SEL = SC_SEL === key ? '' : key;
  document.querySelectorAll('#sc-grid .sc-block').forEach((b) => {
    const on = b.dataset.block === SC_SEL;
    b.classList.toggle('sc-sel', on);
    const pk = b.querySelector('.sc-pick'); pk.classList.toggle('on', on); pk.setAttribute('aria-pressed', String(on));
  });
  const sel = document.getElementById('sc-sel-block'); if (sel) sel.value = SC_SEL;
  scRedraw();
}

function scSet(block, open) {
  open ? SCHEMA_OPEN.add(block.dataset.block) : SCHEMA_OPEN.delete(block.dataset.block);
  block.classList.toggle('sc-open', open);
  block.querySelector('.sc-list').hidden = !open;
  block.querySelector('.sc-head').setAttribute('aria-expanded', String(open));
  block.querySelector('.sc-arrow').textContent = open ? '▾' : '▸';
  document.dispatchEvent(new CustomEvent('schema-layout'));
}
document.addEventListener('schema-layout', scRedraw); // раскрытие блока меняет раскладку
window.addEventListener('resize', scRedraw);
if (typeof ResizeObserver === 'function') document.addEventListener('DOMContentLoaded', () => {
  const w = document.getElementById('schema'); if (w) new ResizeObserver(scRedraw).observe(w);
});
document.addEventListener('click', (e) => {
  const c = e.target.closest ? e.target : e.target.parentElement;
  const ty = c.closest('[data-sc-type]');
  if (ty) {
    const k = ty.dataset.scType; SC_HIDDEN.has(k) ? SC_HIDDEN.delete(k) : SC_HIDDEN.add(k);
    ty.classList.toggle('off', SC_HIDDEN.has(k)); ty.setAttribute('aria-pressed', String(!SC_HIDDEN.has(k)));
    scRedraw(); return;
  }
  const pk = c.closest('[data-sc-pick]');
  if (pk) { scSelect(pk.dataset.scPick); return; }
  if (c.closest('[data-stab="schema"]')) scRedraw(); // вкладка стала видимой
  const h = c.closest('[data-sc-toggle]');
  if (h) { const b = h.closest('.sc-block'); scSet(b, !b.classList.contains('sc-open')); return; }
  if (e.target.id === 'sc-open' || e.target.id === 'sc-close')
    document.querySelectorAll('#sc-grid .sc-block').forEach((b) => scSet(b, e.target.id === 'sc-open'));
});
document.addEventListener('change', (e) => {
  if (e.target.id !== 'sc-sel-block') return;
  SC_SEL = ''; if (e.target.value) scSelect(e.target.value); else scSelect('');
});
