// Вкладка «Форма»: карточка узла и карточка роли Run — модель, tier, effort, скиллы,
// коннекторы (MCP), плагины. Источник — generate.js → formaCatalog (.forma/dashboard/data/forma.cjs,
// фронтматтер .claude/agents/*.md и .claude/agents/run/*.md). Только показ.

const FORMA_EMPTY = '<span class="set-empty">не указано</span>';

function formaEmptyWithNote(note) {
  return `<span class="set-empty" title="${esc(note)}">нет</span>`;
}

function formaConnectorsHtml(connectors) {
  if (!connectors || !connectors.length) return '<span class="dim">—</span>';
  return connectors.map(c => c.level
    ? `<span class="tag" title="найден: ${esc(c.level)}">${esc(c.name)}</span>`
    : `<span class="tag" title="не найден ни в одном файле MCP (.mcp.json, .claude/.mcp.json, ~/.claude.json)">${esc(c.name)} ?</span>`
  ).join(' ');
}

function formaSkillsHtml(skills) {
  if (skills === null) return formaEmptyWithNote('во фронтматтере этого файла нет ключа skills — только tools');
  if (!skills.length) return '<span class="dim">нет (skills: none)</span>';
  return skills.map(s => `<span class="tag">${esc(s)}</span>`).join(' ');
}

// Узлы «Борта», на которые ссылаются полосы текущей отрисовки (попап берёт по индексу).
let formaBortNodes = [];

function formaCardHtml(row, bortNode) {
  let strip = '';
  if (bortNode) { formaBortNodes.push(bortNode); strip = bortStripHtml(bortNode, formaBortNodes.length - 1); }
  return `<div class="nodes-card forma-card">
    <h2>${esc(row.name)}</h2>
    <dl class="kv">
      <dt>Модель</dt><dd>${row.model ? esc(row.model) : FORMA_EMPTY}</dd>
      <dt>Tier</dt><dd>${row.tier ? esc(row.tier) : FORMA_EMPTY}</dd>
      <dt>Effort</dt><dd>${row.effort ? esc(row.effort) : FORMA_EMPTY}</dd>
      <dt>Скиллы</dt><dd>${formaSkillsHtml(row.skills)}</dd>
      <dt>Коннекторы (MCP)</dt><dd>${formaConnectorsHtml(row.connectors)}</dd>
    </dl>
    ${strip}
    <div class="meta">${esc(row.file)} · инструментов: ${row.toolCount}</div>
  </div>`;
}

function formaPluginsHtml(plugins) {
  if (!plugins || !plugins.ran) {
    const reason = plugins && plugins.reason ? esc(plugins.reason) : 'команда недоступна или не вернула список';
    return `<div class="chain-clean">Плагины: ${reason} (ожидали JSON-массив с id/scope/enabled от <code>claude plugin list --json</code>).</div>`;
  }
  const row = (p) => `<span class="tag" title="${p.enabled ? 'включён' : 'выключен'}">${esc(p.id)}${p.enabled ? '' : ' (выключен)'}</span>`;
  // Область пользователя не показана построчно: личная среда разработчика, не относится к проекту (запрет 16) —
  // только число, чтобы было видно, что источник живой, а не пустой.
  return `<div class="forma-plugins">
    <p class="chain-lead">Плагины — данные уровня движка (<code>claude plugin list --json</code>), не узла: привязки «плагин → конкретный узел» в источнике нет, поэтому список один на всю вкладку.</p>
    <p><b>Область проекта:</b> ${plugins.project.length ? plugins.project.map(row).join(' ') : '<span class="dim">нет</span>'}</p>
    <p class="dim">Область пользователя: ${plugins.user.length} плагин(ов), личная среда — не показаны построчно.</p>
  </div>`;
}

let formaShown = null; // выбранный движок: renderPanels перерисовывает вкладку при каждом SSE-обновлении

function formaEngineHtml(e) {
  formaBortNodes = [];
  // Борт считается по одному движку — тому, у кого есть журнал вызовов (claude-code); остальным полосы не рисуются.
  const bort = e.engine === 'claude-code' && latestData && latestData.bort && latestData.bort.source ? latestData.bort : null;
  const card = (r) => formaCardHtml(r, bort && bortFind(bort, r.name));
  const nodesPart = e.rolesMissing
    ? `<div class="chain-clean">Каталог ролей движка не найден — узлы не прочитаны.</div>`
    : `<div class="epics">${e.nodes.map(card).join('')}</div>`;
  const runPart = e.rolesMissing ? ''
    : `<section class="forma-sec forma-sec--run"><h2 class="forma-h">Роли Run</h2>${e.runNote ? `<p class="chain-lead">${esc(e.runNote)}</p>` : ''}${e.runRoles.length ? `<div class="epics">${e.runRoles.map(r => formaCardHtml(r)).join('')}</div>` : ''}</section>`;
  const pluginsPart = e.plugins ? `<h2 class="forma-h">Плагины</h2>${formaPluginsHtml(e.plugins)}` : '';
  return `<p class="chain-lead">Карточка узла — модель, tier, effort, скиллы, коннекторы (MCP); источник — файлы ролей движка «${esc(e.title)}». Пустое поле помечено явно, не молчанием.</p>
    ${bort ? bortSessionBlockHtml(bort) : ''}<section class="forma-sec forma-sec--nodes"><h2 class="forma-h">Узлы</h2>${nodesPart}</section>${bort ? bortSummaryHtml(bort) : ''}${runPart}${pluginsPart}`;
}

function formaHtml(forma) {
  const list = forma && forma.engines ? forma.engines : [];
  if (!list.length) {
    return '<div class="chain-clean">Данных о форме нет — ни у одного движка нет адаптера с описью ролей (forma-adapter.cjs, поле formaRoles).</div>';
  }
  if (!list.some(e => e.engine === formaShown)) formaShown = list[0].engine;
  const tabs = list.map(e => `<button class="side-tab${e.engine === formaShown ? ' on' : ''}" data-e="${esc(e.engine)}">${esc(e.title)}</button>`).join('');
  const body = formaEngineHtml(list.find(e => e.engine === formaShown));
  return `<nav class="side-tabs forma-tabs">${tabs}</nav>${body}`;
}

document.getElementById('nodes').onclick = e => {
  const st = e.target.closest('.bort-strip');
  if (st) {
    const d = document.getElementById('dlg');
    d.innerHTML = `<div class="st-pop bort-pop">${bortNodeHtml(formaBortNodes[+st.dataset.bi])}<button onclick="document.getElementById('dlg').close()">закрыть</button></div>`;
    if (d.open) d.close();
    d.showModal();
    return;
  }
  const b = e.target.closest('.forma-tabs .side-tab');
  if (!b || !latestData) return;
  formaShown = b.dataset.e;
  document.getElementById('nodes').innerHTML = formaHtml(latestData.formaCatalog);
};
