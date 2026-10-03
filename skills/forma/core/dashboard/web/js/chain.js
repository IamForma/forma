// Вкладка «Цепь».

// Название шага: перевод по номеру, запас — то, что отдал сервер.
const stepName = st => { const k = 'chain.step.' + st.n, v = t(k); return v === k ? st.name : v; };

function chainHtml(c){
  if(!c) return '';
  const stepCls = st => st.state==='done' ? 'on' : st.state==='template' ? 'tpl' : 'off';
  const stepTitle = st => st.state==='template'
    ? t('chain.templateStep', {target: st.target})
    : (st.target || '');
  const steps = c.setup.map(st =>
    `<span class="chain-step ${stepCls(st)}" title="${stepTitle(st)}">${st.n} ${stepName(st)}</span>`).join('');

  const dot = (state, title) => {
    const cls = state==='ok' ? 'chain-ok' : state==='bad' ? 'chain-bad' : 'chain-no';
    const ch  = state==='ok' ? '\u2713' : state==='bad' ? '!' : '\u2014';
    return `<span class="chain-link ${cls}" title="${title}">${ch}</span>`;
  };

  const rows = c.goals.map(g => {
    const imageState = g.draft ? 'no' : 'ok';
    const epicState  = g.epic ? (g.draft ? 'bad' : 'ok') : 'no';
    const cardState  = g.cards ? (g.draft ? 'bad' : 'ok') : 'no';
    const cards = g.cards ? (g.cards + (g.cardsDone ? ` <span style="color:var(--ink-faint)">${t('chain.closed', {n: g.cardsDone})}</span>` : '')) : '—';
    return `<tr>
      <td class="mono-cell">${g.id}</td>
      <td>${g.roadmapName || `<span style="color:var(--ink-faint)">${t('chain.noRoadmap')}</span>`}</td>
      <td>${dot(imageState, g.draft?t('chain.goalDraftTip'):t('chain.imageFilled'))} ${g.draft?`<span class="chain-warn">${t('chain.draft')}</span>`:t('chain.ready')}</td>
      <td>${dot(epicState, g.epic||t('chain.noEpic'))}</td>
      <td>${dot(cardState, t('chain.cardsTip', {n: g.cards}))} ${cards}</td>
    </tr>`;
  }).join('');

  const viol = c.violations.length
    ? `<div class="chain-viol"><h3>${t('chain.violTitle', {n: c.violations.length})}</h3><ul>${
        c.violations.map(v => `<li>${t('chain.v.' + v.kind, v.vars)}</li>`).join('')}</ul></div>`
    : `<div class="chain-clean">${t('chain.clean')}</div>`;

  return `
    <p class="chain-lead">${t('chain.lead')}</p>
    <h2>${t('chain.setup')}</h2>
    <div class="chain-steps">${steps}</div>
    <h2>${t('chain.goals', {a: c.summary.goalsWithImage, b: c.summary.goalsTotal, c: c.summary.cardsUnderDraft})}</h2>
    <table class="chain-table">
      <thead><tr><th>${t('chain.th.goal')}</th><th>${t('chain.th.roadmap')}</th><th>${t('chain.th.image')}</th><th>${t('chain.th.epic')}</th><th>${t('chain.th.cards')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${viol}`;
}
