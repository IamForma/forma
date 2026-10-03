// Вкладка «Цепь».

function chainHtml(c){
  if(!c) return '';
  const stepCls = st => st.state==='done' ? 'on' : st.state==='template' ? 'tpl' : 'off';
  const stepTitle = st => st.state==='template'
    ? `${st.target} — файл есть, но это незаполненный шаблон: шаг не сделан`
    : (st.target || '');
  const steps = c.setup.map(st =>
    `<span class="chain-step ${stepCls(st)}" title="${stepTitle(st)}">${st.n} ${st.name}</span>`).join('');

  const dot = (state, title) => {
    const cls = state==='ok' ? 'chain-ok' : state==='bad' ? 'chain-bad' : 'chain-no';
    const ch  = state==='ok' ? '\u2713' : state==='bad' ? '!' : '\u2014';
    return `<span class="chain-link ${cls}" title="${title}">${ch}</span>`;
  };

  const rows = c.goals.map(g => {
    const imageState = g.draft ? 'no' : 'ok';
    const epicState  = g.epic ? (g.draft ? 'bad' : 'ok') : 'no';
    const cardState  = g.cards ? (g.draft ? 'bad' : 'ok') : 'no';
    const cards = g.cards ? (g.cards + (g.cardsDone ? ` <span style="color:var(--ink-faint)">(${g.cardsDone} закр.)</span>` : '')) : '—';
    return `<tr>
      <td class="mono-cell">${g.id}</td>
      <td>${g.roadmapName || '<span style="color:var(--ink-faint)">нет в ROADMAP</span>'}</td>
      <td>${dot(imageState, g.draft?'GOAL.md — черновик':'образ результата заполнен')} ${g.draft?'<span class="chain-warn">черновик</span>':'готов'}</td>
      <td>${dot(epicState, g.epic||'эпика нет')}</td>
      <td>${dot(cardState, g.cards+' карточек')} ${cards}</td>
    </tr>`;
  }).join('');

  const viol = c.violations.length
    ? `<div class="chain-viol"><h3>Порядок нарушен — ${c.violations.length}</h3><ul>${
        c.violations.map(v => `<li>${v.text}</li>`).join('')}</ul></div>`
    : `<div class="chain-clean">Порядок соблюдён: ни одной карточки без образа результата, ни одного эпика без цели.</div>`;

  return `
    <p class="chain-lead">Цепь производства: <b>интервью → образ результата → цель → эпик → карточки</b>.
    Звено не может появиться раньше предыдущего. Ниже — где это правило нарушено;
    прогресс как таковой смотрите на доске, здесь только порядок.</p>
    <h2>Подготовка проекта</h2>
    <div class="chain-steps">${steps}</div>
    <h2>Цели — ${c.summary.goalsWithImage} из ${c.summary.goalsTotal} с заполненным образом,
      ${c.summary.cardsUnderDraft} карточек под черновиками</h2>
    <table class="chain-table">
      <thead><tr><th>Цель</th><th>Строка в ROADMAP</th><th>Образ результата</th><th>Эпик</th><th>Карточки</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${viol}`;
}
