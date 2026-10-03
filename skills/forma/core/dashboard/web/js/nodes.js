// Вкладка «Узлы»: простой список узлов и их оснастки по умолчанию.
// Источник — generate.js → nodeConfig (.forma/dashboard/data/nodes.cjs, фронтматтер .claude/agents/*.md).
// Наборы ролей раннеров и дизайн вкладки — отдельная задача.

function nodesHtml(nodes) {
  if (!nodes || !nodes.length) {
    return '<div class="chain-clean">Данных об узлах нет — каталог ролей (.claude/agents) не найден.</div>';
  }
  const rows = nodes.map(n => `<tr>
    <td><b>${esc(n.node)}</b></td>
    <td>${n.model ? esc(n.model) : '<span class="set-empty">не указана</span>'}</td>
    <td>${n.effort ? esc(n.effort) : '<span class="set-empty">не указано</span>'}</td>
    <td>${n.toolCount}</td>
    <td>${n.externalModel ? 'да' : '—'}</td>
  </tr>`).join('');
  return `<p class="chain-lead">Пять узлов и их оснастка по умолчанию. Источник — фронтматтер
  <code>.claude/agents/*.md</code>: опись не может разойтись с действительностью, потому что она
  и есть действительность.</p>
  <table class="chain-table"><thead><tr><th>Узел</th><th>Модель</th><th>Усилие</th><th>Инструментов</th><th>Внешняя модель</th></tr></thead>
  <tbody>${rows}</tbody></table>`;
}
