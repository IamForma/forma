// Вкладка «Дашборд» — первая, общий вид доски: KPI, прогресс по эпикам, критический путь,
// таблица карточек с поиском/фильтрами и переключателем Таблица/Канбан. Данные — из общего
// среза (`d.board.cards`, `d.epics`, `d.totals`), ничего не вшито; числа совпадают с доской.
// dashInit(d) вызывается на каждый срез данных (как boardInit), DASH хранит выбор между перерисовками.

let DASH = null;

function dashLoadState() {
  const S = { q: '', status: null, epic: null, view: 'table' };
  try { Object.assign(S, JSON.parse(localStorage.getItem('dashView') || '{}')); } catch { /* localStorage закрыт — значения по умолчанию */ }
  return S;
}
function dashSave(S) { try { localStorage.setItem('dashView', JSON.stringify(S)); } catch { /* закрыт — выбор не запомнится */ } }

// Расход по движкам (токены + поправка «mixed»): кэш больше N у записи — строка написана
// без кэша в общем числе (board-card.cjs, addSpendLine), добавляем кэш к токенам.
function dashSpendByEngine(c) {
  const out = {};
  for (const [k, e] of Object.entries((c.spend || {}).byEngine || {})) out[k] = { tokens: e.tokens + (e.mixed ? e.cache : 0), cache: e.cache };
  return out;
}
function dashCardSpend(c) {
  let tokens = 0, cache = 0;
  for (const v of Object.values(dashSpendByEngine(c))) { tokens += v.tokens; cache += v.cache; }
  return { tokens, cache, sec: (c.spend || {}).sec || 0, attempts: c.attempts || 0 };
}
function dashAgeDays(modified, generated) {
  const a = new Date(String(modified || '').slice(0, 10)).getTime(), b = new Date(String(generated || '').slice(0, 10)).getTime();
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 86400000)) : null;
}

function dashKpiHtml(totals, epics, cards) {
  const done = totals.byStatus.done || 0, inProgress = totals.byStatus['in-progress'] || 0, review = totals.byStatus.review || 0;
  const pct0 = totals.cardCount ? Math.round(done / totals.cardCount * 100) : 0;
  const activeEpics = epics.filter(e => (e.byStatus.done || 0) < e.cardCount).length;
  const byEngine = {};
  for (const c of cards) for (const [k, v] of Object.entries(dashSpendByEngine(c))) {
    const o = byEngine[k] || (byEngine[k] = { tokens: 0, cache: 0 }); o.tokens += v.tokens; o.cache += v.cache;
  }
  const keys = Object.keys(byEngine).sort((a, b) => byEngine[b].tokens - byEngine[a].tokens);
  const top = keys[0], tok = top ? byEngine[top] : null;
  const cachePct = tok && tok.tokens ? Math.round(tok.cache / tok.tokens * 100) : 0;
  const tiles = [
    { cls: 'hero', lbl: t('dash.kpi.progress'), num: pct0 + '%' },
    { lbl: t('dash.kpi.accepted'), num: done + '/' + totals.cardCount },
    { lbl: STATUS_LABEL['in-progress'], num: inProgress },
    { lbl: STATUS_LABEL.review, num: review },
    { lbl: t('dash.kpi.epics'), num: activeEpics + '/' + epics.length },
    { lbl: top ? t('dash.kpi.tokensOf', { e: engineLabel(top) }) : t('dash.kpi.tokens'), num: tok ? fmt(tok.tokens) : '—',
      sub: tok && tok.cache ? `<div class="lbl">${t('dash.kpi.cache', { p: cachePct })}</div>` : '' },
  ];
  return `<section class="tiles">${tiles.map(x => `<div class="tile kpi ${x.cls || ''}"><div class="lbl">${x.lbl}</div><div class="num mono">${x.num}</div>${x.sub || ''}</div>`).join('')}</section>`;
}

function dashEpicBarsHtml(S, epics) {
  if (!epics.length) return `<div class="nodata">${t('dash.epics.empty')}</div>`;
  return epics.map(e => {
    const done = e.byStatus.done || 0, total = e.cardCount, pct0 = total ? Math.round(done / total * 100) : 0;
    const off = S.epic && S.epic !== e.epic ? ' off' : '';
    return `<div class="ebar-row${off}" data-epic="${esc(e.epic)}">
      <div class="ebar-top"><b>${esc(e.epic)}</b><span class="mono">${done}/${total} · ${pct0}%</span></div>
      <div class="ebar-track"><div class="ebar-fill" style="width:${pct0}%"></div></div>
    </div>`;
  }).join('');
}

function dashCritHtml(cards) {
  const open = cards.filter(c => c.status !== 'done').sort((a, b) => (+a.code.slice(5) || 0) - (+b.code.slice(5) || 0)).slice(0, 16);
  if (!open.length) return `<div class="empty">${t('dash.crit.empty')}</div>`;
  return open.map(c => `<li class="${c.humanFlag ? 'human' : ''}" style="--c:var(${STATUS_VAR[c.status]})" data-code="${c.code}">
      <span class="code mono">${c.code}</span>
      <div class="t">${esc(c.title)}</div>
      <div class="tags"><span class="tag">${esc(STATUS_LABEL[c.status])}</span><span class="tag">${esc((c.epic || '—').split('/')[0])}</span>
        ${c.assignee ? `<span class="tag">${esc(c.assignee)}</span>` : ''}${c.humanFlag ? `<span class="tag" style="color:#BE463C">${t('dash.crit.human')}</span>` : ''}</div>
    </li>`).join('');
}

function dashFiltered(S, cards) {
  const q = S.q.trim().toLowerCase();
  return cards.filter(c => (!S.status || c.status === S.status) && (!S.epic || c.epic === S.epic) &&
    (!q || (c.code + ' ' + c.title).toLowerCase().includes(q)));
}

function dashFiltersHtml(S, cards) {
  const counts = {};
  for (const c of cards) counts[c.status] = (counts[c.status] || 0) + 1;
  const chips = STATUS_ORDER.map(s => `<span class="chip ${S.status === s ? 'on' : ''}" data-status="${s}">${esc(STATUS_LABEL[s])}<span class="n">${counts[s] || 0}</span></span>`).join('');
  const epicChip = S.epic ? `<span class="chip on" data-epic-clear="1">${esc(t('dash.filters.epic', { e: S.epic.split('/')[0] }))} ✕</span>` : '';
  return chips + epicChip;
}

function dashRowHtml(c, generated) {
  const sp = dashCardSpend(c), age = dashAgeDays(c.modified, generated);
  const tok = sp.tokens ? fmt(sp.tokens) + (sp.cache ? ` <span class="dim">(${fmt(sp.cache)})</span>` : '') : '—';
  return `<tr data-code="${c.code}">
    <td class="mono">${c.code}</td>
    <td class="ttl" title="${esc(c.title)}"><div class="clamp">${esc(c.title)}</div></td>
    <td>${esc((c.epic || '—').split('/')[0])}</td>
    <td>${esc(c.assignee || '—')}</td>
    <td><span class="pill" style="background:var(${STATUS_VAR[c.status]});color:#fff;border-color:transparent">${esc(STATUS_LABEL[c.status])}</span></td>
    <td class="n">${age == null ? '—' : cnt('count.days', age)}</td>
    <td class="n mono">${tok}</td>
    <td class="ttl" title="${esc((c.next || "").slice(0, 400))}"><div class="clamp">${esc((c.next || "").slice(0, 160))}</div></td>
  </tr>`;
}

function dashTableHtml(S, cards, generated) {
  const rows = dashFiltered(S, cards);
  if (!rows.length) return `<div class="empty">${t('dash.table.empty')}</div>`;
  return `<div class="etable-scroll"><table class="dtable" style="min-width:760px">
    <thead><tr><th>${t('dash.th.code')}</th><th>${t('dash.th.title')}</th><th>${t('dash.th.epic')}</th><th>${t('dash.th.node')}</th>
      <th>${t('dash.th.status')}</th><th class="n">${t('dash.th.age')}</th><th class="n">${t('dash.th.tokens')}</th><th>${t('dash.th.next')}</th></tr></thead>
    <tbody>${rows.map(c => dashRowHtml(c, generated)).join('')}</tbody>
  </table></div>`;
}

function dashKanbanHtml(S, cards) {
  const rows = dashFiltered(S, cards);
  return `<div class="kcols">${STATUS_ORDER.map(s => {
    const items = rows.filter(c => c.status === s);
    return `<div class="kcol"><h3><span>${esc(STATUS_LABEL[s])}</span><span>${items.length}</span></h3>${
      items.map(c => `<div class="kcard" style="--c:var(${STATUS_VAR[s]})" data-code="${c.code}">
          <div class="code mono">${c.code}</div><div class="t">${esc(c.title)}</div><div class="tag">${esc((c.epic || '—').split('/')[0])}</div>
        </div>`).join('') || `<div class="empty">${t('board.empty')}</div>`}</div>`;
  }).join('')}</div>`;
}

function dashOpenCard(code) {
  const c = DASH.board.cards.find(x => x.code === code);
  if (!c) return;
  const sp = dashCardSpend(c), d = document.getElementById('dlg');
  if (d.open) d.close();
  d.innerHTML = `<button onclick="this.closest('dialog').close()">✕</button>
    <div class="code mono">${c.code} · ${esc(STATUS_LABEL[c.status])} · ${esc(c.assignee || '—')}</div><h2>${esc(c.title)}</h2>
    <dl>
      <dt>${t('board.delivers')}</dt><dd>${esc(c.delivers)}</dd>
      <dt>${t('board.criterion')}</dt><dd>${esc(c.criterion)}</dd>
      <dt>${t('board.next')}</dt><dd>${esc(c.next)}</dd>
      <dt>${t('dash.th.tokens')}</dt><dd>${sp.tokens ? fmt(sp.tokens) + (sp.cache ? ' (' + fmt(sp.cache) + ' cache-read)' : '') : t('dash.spend.none')}</dd>
    </dl>`;
  d.showModal();
}

function dashRender() {
  const { S, board, epics, totals } = DASH;
  dashSave(S);
  document.getElementById('dash-kpi').innerHTML = dashKpiHtml(totals, epics, board.cards);
  document.getElementById('dash-epics').innerHTML = dashEpicBarsHtml(S, epics);
  document.getElementById('dash-crit').innerHTML = dashCritHtml(board.cards);
  document.getElementById('dash-filters').innerHTML = dashFiltersHtml(S, board.cards);
  document.getElementById('dash-table').innerHTML = S.view === 'table' ? dashTableHtml(S, board.cards, board.generated) : '';
  document.getElementById('dash-kanban').innerHTML = S.view === 'kanban' ? dashKanbanHtml(S, board.cards) : '';
  document.getElementById('dash-table').hidden = S.view !== 'table';
  document.getElementById('dash-kanban').hidden = S.view !== 'kanban';
  document.querySelectorAll('#dash-switch span').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));
}

function dashInit(d) {
  DASH = { board: d.board, epics: d.epics || [], totals: d.totals, S: dashLoadState() };
  document.getElementById('dash-q').value = DASH.S.q;
  dashRender();
}

(function bindDashEvents() {
  document.addEventListener('click', e => {
    if (!DASH) return;
    const open = e.target.closest('#dash [data-code]');
    if (open) { dashOpenCard(open.dataset.code); return; }
    const chipStatus = e.target.closest('#dash-filters [data-status]');
    if (chipStatus) { const s = chipStatus.dataset.status; DASH.S.status = DASH.S.status === s ? null : s; dashRender(); return; }
    const epicClear = e.target.closest('#dash-filters [data-epic-clear]');
    if (epicClear) { DASH.S.epic = null; dashRender(); return; }
    const ebar = e.target.closest('#dash-epics [data-epic]');
    if (ebar) { const ep = ebar.dataset.epic; DASH.S.epic = DASH.S.epic === ep ? null : ep; dashRender(); return; }
    const sw = e.target.closest('#dash-switch span');
    if (sw) { DASH.S.view = sw.dataset.view; dashRender(); return; }
  });
  document.addEventListener('input', e => {
    if (DASH && e.target.id === 'dash-q') { DASH.S.q = e.target.value; dashRender(); }
  });
})();
