// Вкладка «Форма»: карточка узла и карточка роли Run — модель, tier, effort, скиллы,
// коннекторы (MCP), плагины. Источник — generate.js → formaCatalog (.forma/dashboard/data/forma.cjs,
// фронтматтер .claude/agents/*.md и .claude/agents/run/*.md). Только показ.

const formaEmpty = () => `<span class="set-empty">${t('fm.notSet')}</span>`;

function formaEmptyWithNote(note) {
  return `<span class="set-empty" title="${esc(note)}">${t('fm.no')}</span>`;
}

function formaConnectorsHtml(connectors) {
  if (!connectors || !connectors.length) return '<span class="dim">—</span>';
  return connectors.map(c => c.level
    ? `<span class="tag" title="${esc(t('fm.foundTip', {level: c.level}))}">${esc(c.name)}</span>`
    : `<span class="tag" title="${esc(t('fm.notFoundTip'))}">${esc(c.name)} ?</span>`
  ).join(' ');
}

function formaSkillsHtml(skills) {
  if (skills === null) return formaEmptyWithNote(t('fm.noSkillsKey'));
  if (!skills.length) return `<span class="dim">${t('fm.noSkills')}</span>`;
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
      <dt>${t('fm.model')}</dt><dd>${row.model ? esc(row.model) : formaEmpty()}</dd>
      <dt>Tier</dt><dd>${row.tier ? esc(row.tier) : formaEmpty()}</dd>
      <dt>Effort</dt><dd>${row.effort ? esc(row.effort) : formaEmpty()}</dd>
      <dt>${t('fm.skills')}</dt><dd>${formaSkillsHtml(row.skills)}</dd>
      <dt>${t('fm.connectors')}</dt><dd>${formaConnectorsHtml(row.connectors)}</dd>
    </dl>
    ${strip}
    <div class="meta">${esc(row.file)} · ${t('fm.tools', {n: row.toolCount})}</div>
  </div>`;
}

function formaPluginsHtml(plugins) {
  if (!plugins || !plugins.ran) {
    const reason = plugins && plugins.reason ? esc(plugins.reason) : t('fm.pluginsNoList');
    return `<div class="chain-clean">${t('fm.pluginsErr', {reason})}</div>`;
  }
  const row = (p) => `<span class="tag" title="${p.enabled ? t('fm.enabled') : t('fm.disabled')}">${esc(p.id)}${p.enabled ? '' : ' ' + t('fm.disabledParen')}</span>`;
  // Область пользователя не показана построчно: личная среда разработчика, не относится к проекту (запрет 16) —
  // только число, чтобы было видно, что источник живой, а не пустой.
  return `<div class="forma-plugins">
    <p class="chain-lead">${t('fm.pluginsLead')}</p>
    <p><b>${t('fm.projectScope')}</b> ${plugins.project.length ? plugins.project.map(row).join(' ') : `<span class="dim">${t('fm.no')}</span>`}</p>
    <p class="dim">${t('fm.userScope', {n: plugins.user.length})}</p>
  </div>`;
}

let formaShown = null; // выбранный движок: renderPanels перерисовывает вкладку при каждом SSE-обновлении

function formaEngineHtml(e) {
  formaBortNodes = [];
  // Борт считается по одному движку — тому, у кого есть журнал вызовов (claude-code); остальным полосы не рисуются.
  const bort = e.engine === 'claude-code' && latestData && latestData.bort && latestData.bort.source ? latestData.bort : null;
  const card = (r) => formaCardHtml(r, bort && bortFind(bort, r.name));
  const nodesPart = e.rolesMissing
    ? `<div class="chain-clean">${t('fm.rolesMissing')}</div>`
    : `<div class="epics">${e.nodes.map(card).join('')}</div>`;
  const runPart = e.rolesMissing ? ''
    : `<section class="forma-sec forma-sec--run"><h2 class="forma-h">${t('fm.runRoles')}</h2>${e.runNote ? `<p class="chain-lead">${esc(typeof e.runNote === 'object' ? t(e.runNote.key, e.runNote.vars) : e.runNote)}</p>` : ''}${e.runRoles.length ? `<div class="epics">${e.runRoles.map(r => formaCardHtml(r)).join('')}</div>` : ''}</section>`;
  const pluginsPart = e.plugins ? `<h2 class="forma-h">${t('fm.plugins')}</h2>${formaPluginsHtml(e.plugins)}` : '';
  return `<p class="chain-lead">${t('fm.lead', {title: esc(e.title)})}</p>
    ${bort ? bortSessionBlockHtml(bort) : ''}<section class="forma-sec forma-sec--nodes"><h2 class="forma-h">${t('fm.nodes')}</h2>${nodesPart}</section>${bort ? bortSummaryHtml(bort) : ''}${runPart}${pluginsPart}`;
}

function formaHtml(forma) {
  const list = forma && forma.engines ? forma.engines : [];
  if (!list.length) {
    return `<div class="chain-clean">${t('fm.noData')}</div>`;
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
    d.innerHTML = `<div class="st-pop bort-pop">${bortNodeHtml(formaBortNodes[+st.dataset.bi])}<button onclick="document.getElementById('dlg').close()">${t('eng.close')}</button></div>`;
    if (d.open) d.close();
    d.showModal();
    return;
  }
  const b = e.target.closest('.forma-tabs .side-tab');
  if (!b || !latestData) return;
  formaShown = b.dataset.e;
  document.getElementById('nodes').innerHTML = formaHtml(latestData.formaCatalog);
};
