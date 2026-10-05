// Вкладка «Закон» и переключатель вкладок. Зовётся из boardInit (board.js) и получает то, что живёт в его области:
// DATA, esc, T (подписи), lbl (подпись метки), ROUTES (карта маршрутов). Возвращает linkLaw — ссылки «§N» в окнах доски.
// Состояние вызова — объект L ({ DATA, esc, T, lbl, ROUTES, tab }); каждый вызов lawInit начинает с вкладки «Закон §1–7».

// --- Вкладка «Закон»: AGENTS.md и всё, чем он управляет (данные — DATA.law, собирает build-board-demo.cjs) ---
// Подписи вычисляются при обращении: язык меняется без перезагрузки.
const LAW_SEC = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? t('law.sec.' + k) : '') });
const prohibList = () => Array.from({ length: 15 }, (_, i) => t('law.prohib.' + (i + 1)));
const lawCheckText = (k) => { const x = t('law.check.' + k); return x === 'law.check.' + k ? '' : x; };
const LAW_ROLES = ['intent', 'spec', 'kit', 'run', 'core', 'extractor'];
const lawRoleText = (r) => (LAW_ROLES.includes(r.name) ? t('law.role.' + r.name) : r.desc);
const lawNav = () => [['law', t('law.nav.law')], ['engine', t('law.nav.engine')], ['routes', t('law.nav.routes')], ['roles', t('law.nav.roles')], ['ondemand', t('law.nav.ondemand')], ['checks', t('law.nav.checks')], ['project', t('law.nav.project')], ['.forma/manual', t('law.nav.manual')]];

function lawMd(L, t) { // marked с CDN; без сети — простой показ
  t = String(t || '').replace(/\r/g, '');
  if (window.marked) return marked.parse(t);
  return '<pre class="raw">' + L.esc(t) + '</pre>';
}
function lawSplitSections(t) { // AGENTS.md → вступление + §1…§7
  const parts = t.replace(/\r/g, '').split(/^## (?=\d+\. )/m);
  return { intro: parts[0], secs: parts.slice(1).map(p => { const n = +p.match(/^(\d+)/)[1]; const nl = p.indexOf('\n'); return { n, title: p.slice(0, nl).replace(/^\d+\.\s*/, ''), body: p.slice(nl + 1) }; }) };
}
function lawBodyLaw(L, anchor) {
  const { esc } = L, md = t => lawMd(L, t);
  const { intro, secs } = lawSplitSections(L.DATA.law.agents);
  return `<div class="lawgrid"><aside class="toc"><b>AGENTS.md</b>${secs.map(s => `<a href="#" data-sec="s${s.n}">§${s.n} ${LAW_SEC[s.n] || ''}<small>${esc(s.title)}</small></a>`).join('')}</aside>
      <div class="lawtext"><p class="note">${curLang() === 'ru' ? t('law.lawNote') : t('law.lawNoteEn')}</p>
      <details class="sec"><summary>${t('law.intro')}</summary><div class="md">${md(intro)}</div></details>
      ${secs.map(s => `<details class="sec" id="s${s.n}" ${anchor === 's' + s.n ? 'open' : ''}><summary><b>§${s.n} · ${LAW_SEC[s.n] || ''}</b> <small>${esc(s.title)}</small></summary><div class="md">${md(s.body)}</div>
        ${s.n === 5 && curLang() === 'ru' ? `<div id="s5p"><h4>${t('law.prohibRu')}</h4><ol>${prohibList().map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>` : ''}</details>`).join('')}</div></div>`;
}
function lawBodyEngine(L) {
  return `<p class="note">${t('law.engineNote')}</p><div class="md lawtext">${lawMd(L, L.DATA.law.engine)}</div>`;
}
function lawBodyRoutes(L) {
  const { DATA, esc, T, lbl, ROUTES } = L;
  return `<p class="note">${t('law.routesNote')}</p>
      <div class="rgrid">${Object.entries(ROUTES).map(([k, R]) => `<div class="rcard"><div class="code">${esc(lbl(k))} <small>${k}</small>${/route-[0-5]/.test(k) ? ` · <span class="miss">${t('law.humanApproval')}</span>` : ''}</div><b>${esc(R[0])}</b>
        <div class="route">${R[1].map((s, i) => `${i ? '<span class="arrow">→</span>' : ''}<div class="stage"><small>${esc(T.stage[s[0]] || s[0])}</small>${esc(s[1])}</div>`).join('')}</div>
        <small>${t('law.cardsN', {n: DATA.cards.filter(c => c.route === k).length})}</small></div>`).join('')}</div>
      <h3>${t('law.whyCodes')}</h3><dl class="kv">${Object.entries(T.why).map(([k, v]) => `<dt><code>${k}</code></dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <h3>${t('law.stageKeys')}</h3><dl class="kv">${Object.entries(T.stage).filter(([k]) => k !== 'closed').map(([k, v]) => `<dt><code>${k}</code></dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <details class="sec"><summary><b>${t('law.routesRef')}</b> <small>.forma/manual/${curLang()}/03-forma/ROUTES.md</small></summary><div class="md">${lawMd(L, DATA.law.routes)}</div></details>`;
}
function lawBodyRoles(L, tab) {
  const { DATA, esc } = L, list = tab === 'roles' ? DATA.law.roles : DATA.law.onDemand;
  return `<p class="note">${tab === 'roles' ? t('law.rolesNote') : t('law.ondemandNote')}</p>
      ${list.map(r => `<details class="sec role"><summary><b>${esc(r.name)}</b> <small>${esc(lawRoleText(r))}</small>${r.model ? `<span class="tag">${esc(r.model)}</span>` : ''}${r.effort ? `<span class="tag">${esc(t('law.effort', {v: r.effort}))}</span>` : ''}</summary>
        ${r.tools ? `<div class="tools"><b>${t('law.toolsLbl')}</b> ${r.tools.split(/,\s*/).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="meta">${esc(r.file)}</div><div class="md">${lawMd(L, r.body)}</div></details>`).join('')}`;
}
function lawBodyChecks(L) {
  const { esc } = L, LW = L.DATA.law;
  return `<p class="note">${t('law.checksNote')}</p>
      <table class="tbl"><tr><th>${t('law.th.rule')}</th><th>${t('law.th.checks')}</th><th>${t('law.th.since')}</th></tr>${Object.entries(LW.checkDates).map(([k, d]) => `<tr><td><code>${k}</code></td><td>${esc(lawCheckText(k))}</td><td>${d}</td></tr>`).join('')}</table>
      <h3>${t('law.checkSections')}</h3><ul>${LW.checks.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      <p class="note">${t('law.alsoNote')}</p>`;
}
function lawBodyProject(L) {
  const { DATA } = L;
  return `<p class="note">${t('law.projectNote', {a: DATA.thresholds.attempts ?? '—', v: DATA.thresholds.volume ?? '—'})}</p><div class="md lawtext">${lawMd(L, DATA.law.project)}</div>`;
}
function lawBodyManual(L) {
  return `<p class="note">${t('law.protocolNote')}</p><div class="md lawtext">${lawMd(L, L.DATA.law.protocol)}</div>`;
}
function lawBodyHtml(L, anchor) {
  const tab = L.tab;
  if (tab === 'law') return lawBodyLaw(L, anchor);
  if (tab === 'engine') return lawBodyEngine(L);
  if (tab === 'routes') return lawBodyRoutes(L);
  if (tab === 'roles' || tab === 'ondemand') return lawBodyRoles(L, tab);
  if (tab === 'checks') return lawBodyChecks(L);
  if (tab === 'project') return lawBodyProject(L);
  if (tab === '.forma/manual') return lawBodyManual(L);
  return '';
}
function lawRender(L, anchor) {
  const el = document.getElementById('view-law');
  const nav = `<nav class="lawnav">${lawNav().map(([k, n]) => `<span class="chip ${L.tab === k ? 'on' : ''}" data-lt="${k}">${n}</span>`).join('')}</nav>`;
  el.innerHTML = nav + lawBodyHtml(L, anchor);
  if (anchor) { const a = document.getElementById(anchor); if (a) { a.closest('details')?.setAttribute('open', ''); a.scrollIntoView({ block: 'start' }); } }
}
// Вкладка «Настройки» — контейнер, внутри подвкладки «Закон», «Движок», «Борт», «Структура» (переносятся как есть).
const SETTINGS_TABS = ['law', 'project', 'engine', 'structure'];
function settingsSetTab(tab) {
  SETTINGS_TABS.forEach(t => { const el = document.getElementById('view-' + t); if (el) el.hidden = t !== tab; });
  document.querySelectorAll('#settings-nav .chip').forEach(c => c.classList.toggle('on', c.dataset.stab === tab));
}
function settingsRender(L, tab, anchor) {
  settingsSetTab(tab);
  if (tab === 'law') { if (anchor) L.tab = 'law'; lawRender(L, anchor); }
}
// Вкладки наверху; «§N» на доске и в окнах — ссылка в закон (вкладка «Настройки», подвкладка «Закон»).
function lawSetView(L, v, settingsTab, anchor) {
  document.getElementById('view-board').hidden = v !== '.forma/board';
  document.getElementById('view-settings').hidden = v !== 'settings';
  for (const x of LX_PANELS) document.getElementById('view-' + x).hidden = v !== x;
  const tab = document.querySelector(`.tab[data-view="${v}"]`);
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.view === v));
  document.title = `${L.DATA.project} · ${v === '.forma/board' ? t('law.kanban') : tab.textContent}`;
  // Переключение вкладки — это новая страница: старая прокрутка body, унаследованная
  // от предыдущей вкладки, иначе оставляет контент визуально «ниже» верхних вкладок.
  window.scrollTo(0, 0);
  if (v === 'settings') settingsRender(L, settingsTab || L.settingsTab || 'law', anchor);
  try { history.replaceState(null, '', v === '.forma/board' ? '#' : '#' + v); } catch { /* адрес не меняется (file://, песочница) — вкладка всё равно переключена */ }
}
function lawInit({ DATA, esc, T, lbl, ROUTES }) {
  const L = { DATA, esc, T, lbl, ROUTES, tab: 'law', settingsTab: 'law' };
  document.getElementById('view-law').onclick = e => {
    const t = e.target.closest('[data-lt]'); if (t) { L.tab = t.dataset.lt; lawRender(L); return; }
    const s = e.target.closest('[data-sec]'); if (s) { e.preventDefault(); lawRender(L, s.dataset.sec); }
  };
  document.querySelector('.tabs').onclick = e => { const t = e.target.closest('.tab'); if (t) lawSetView(L, t.dataset.view); };
  document.getElementById('settings-nav').onclick = e => {
    const t = e.target.closest('.chip'); if (!t) return;
    L.settingsTab = t.dataset.stab; settingsRender(L, L.settingsTab);
  };
  const linkLaw = html => html.replace(/§\s?([1-8])(?![^<]*>)/g, (m, n) => `<a href="#" class="lawlink" data-law="${n}">${m}</a>`);
  if (window.lawClick) document.removeEventListener('click', window.lawClick);
  document.addEventListener('click', window.lawClick = e => {
    const a = e.target.closest('.lawlink'); if (!a) return; e.preventDefault();
    document.getElementById('dlg').close?.();
    L.settingsTab = 'law';
    if (a.dataset.law === '8') { L.tab = 'engine'; lawSetView(L, 'settings', 'law'); } else lawSetView(L, 'settings', 'law', 's' + a.dataset.law);
  });
  { const h = location.hash.slice(1); if (['settings', 'interview', 'nodes', 'docs', 'economy', 'graphs'].includes(h)) lawSetView(L, h); }
  return { linkLaw };
}
