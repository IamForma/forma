// Вкладка «Узлы»: простой список узлов и их оснастки по умолчанию.
// Источник — generate.js → nodeConfig (.forma/dashboard/data/nodes.cjs, фронтматтер .claude/agents/*.md).
// Наборы ролей раннеров и дизайн вкладки — отдельная задача.

function nodesHtml(nodes) {
  if (!nodes || !nodes.length) {
    return `<div class="chain-clean">${t('nodes.none')}</div>`;
  }
  const rows = nodes.map(n => `<tr>
    <td><b>${esc(n.node)}</b></td>
    <td>${n.model ? esc(n.model) : `<span class="set-empty">${t('nodes.notSet')}</span>`}</td>
    <td>${n.effort ? esc(n.effort) : `<span class="set-empty">${t('nodes.notSetN')}</span>`}</td>
    <td>${n.toolCount}</td>
    <td>${n.externalModel ? t('nodes.yes') : '—'}</td>
  </tr>`).join('');
  return `<p class="chain-lead">${t('nodes.lead')}</p>
  <table class="chain-table"><thead><tr><th>${t('nodes.th.node')}</th><th>${t('nodes.th.model')}</th><th>${t('nodes.th.effort')}</th><th>${t('nodes.th.tools')}</th><th>${t('nodes.th.external')}</th></tr></thead>
  <tbody>${rows}</tbody></table>`;
}
