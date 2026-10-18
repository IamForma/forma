// Вкладка «Графы»: панели graphify и рамка выбранного графа.

// Три отдельные компактные панели (по одной под каждой вкладкой графа), не единая сводная —
// каждая несёт числа именно своего корпуса, не агрегат по всем трём разом
// (`kit.md`-задача «механизм контроля создания графов», п.4).
// Подписи вычисляются при обращении: язык меняется без перезагрузки.
const GRAPHIFY_CORPUS_LABEL = { get project(){ return t('gr.label.project'); }, get manual(){ return t('gr.label.manual'); }, get 'done-cards'(){ return t('gr.label.experience'); }, get site(){ return t('gr.label.site'); }, get engine(){ return t('gr.label.engine'); } };
const GRAPHIFY_CORPUS_HINT = {
  project: '/graphify project --update',
  manual: '/graphify manual --update',
  get 'done-cards'(){ return t('gr.hint.experience'); },
  site: 'node .claude/scripts/build-site-graph.cjs',
  engine: 'node .claude/scripts/build-engine-graph.cjs',
};

function graphifyBadgeHtml(html){
  return `<div class="status-chip" style="background:var(--st-review, #a0522d); margin:0 0 8px; display:block; width:fit-content; color:#fff; border-color:transparent; white-space:normal; text-transform:none; letter-spacing:normal; font-size:12px; padding:6px 10px;">⚠ ${html}</div>`;
}

function graphifyPanelHtml(corpus, entry){
  const label = GRAPHIFY_CORPUS_LABEL[corpus] || corpus;
  const hint = GRAPHIFY_CORPUS_HINT[corpus] || '/graphify';
  if (!entry || !entry.lastRun) {
    return `<section class="config-card" style="margin-bottom:12px">
      <h2>Graphify — ${label}</h2>
      <div class="node-empty" style="padding:10px 18px 16px">${t('gr.neverBuilt', {hint})}</div>
    </section>`;
  }
  const r = entry.lastRun;
  const badges = [];
  if (entry.stale) badges.push(graphifyBadgeHtml(t('gr.stale', {corpus, hint})));
  if (entry.pending && entry.pending.pending) badges.push(graphifyBadgeHtml(t('gr.pending', {a: entry.pending.accumulatedEvents ?? '?', b: entry.pending.threshold ?? '?'})));
  if (entry.budgetStop) badges.push(graphifyBadgeHtml(t('gr.budget', {done: entry.budgetStop.filesProcessed, total: entry.budgetStop.filesTotal, cost: '$' + entry.budgetStop.costUsd.toFixed(4), max: '$' + entry.budgetStop.maxUsdPerBuild, hint})));

  return `<section class="config-card" style="margin-bottom:12px">
    <h2>Graphify — ${label}</h2>
    <div style="padding:${badges.length ? '10px' : '0'} 18px 0">${badges.join('')}</div>
    <div class="tiles" style="border:none; box-shadow:none; margin:10px 18px 4px; width:calc(100% - 36px)">
      <div class="tile"><div class="num">${r.nodes != null ? fmt(r.nodes) : '—'}</div><div class="lbl">${t('gr.nodes')}</div></div>
      <div class="tile"><div class="num">${r.edges != null ? fmt(r.edges) : '—'}</div><div class="lbl">${t('gr.edges')}</div></div>
      <div class="tile"><div class="num">${r.communities != null ? fmt(r.communities) : '—'}</div><div class="lbl">${t('gr.clusters')}</div></div>
      <div class="tile ${!r.warnings ? 'pending' : ''}"><div class="num">${r.warnings != null ? fmt(r.warnings) : '0'}</div><div class="lbl">${t('gr.warnings')}</div></div>
    </div>
    <div style="padding:0 18px 14px; font-size:12.5px; color:var(--ink-soft)">
      ${t('gr.built')} <b class="mono" style="color:var(--ink)">${timeAgo(r.at)}</b> · ${t('gr.trigger')}: <b class="mono" style="color:var(--ink)">${r.trigger || '—'}</b> · ${t('gr.cost')}: <b class="mono" style="color:var(--ink)">${r.costUsd ? '$' + r.costUsd.toFixed(4) : '—'}</b>
    </div>
  </section>`;
}

function renderGraphifyPanels(data){
  const byCorpus = data.graphifyByCorpus || {};
  for (const corpus of ['project', '.forma/manual', 'done-cards', 'site', 'engine']) {
    const el = document.getElementById('graphify-panel-' + corpus);
    if (el) el.innerHTML = graphifyPanelHtml(corpus, byCorpus[corpus]);
  }
}

function showGraph(c) {
  document.querySelectorAll('#graphs .side-tab').forEach(b => b.classList.toggle('on', b.dataset.c === c));
  document.getElementById('gp').innerHTML = graphifyPanelHtml(c, (latestData.graphifyByCorpus || {})[c]) + ((latestData.graphsBuilt || {})[c]
    ? `<iframe class="graph-frame" src="/graphs/${c}/graph.html" title="${esc(t('gr.frameTitle', {c}))}"></iframe>`
    : `<div class="graph-empty">${t('gr.empty')}</div>`);
}
let graphShown = null;
document.getElementById('graphs').onclick = e => { const b = e.target.closest('.side-tab'); if (b) showGraph(graphShown = b.dataset.c); };
