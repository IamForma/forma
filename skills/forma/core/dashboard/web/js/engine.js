// Вкладки «Проект» и «Движок» в настройках: только показ; каталог маршрутов.
// Все строки интерфейса — через t() из словарей, ключи `eng.*`. Локальные переменные не называть `t`.

/* Общие кирпичи: плитка, плашка, таблица, сворачиваемый раздел. */
const setEmpty = () => `<span class="set-empty">${t('eng.empty')}</span>`;
const setTile = (num, lbl, cls = '') => `<div class="bs-tile ${cls}"><b>${num}</b><span>${lbl}</span></div>`;
const setPill = (txt, cls = '', title = '') => `<span class="set-pill ${cls}"${title ? ` title="${esc(title)}"` : ''}>${esc(txt)}</span>`;
const setSrc = (s) => `<span class="set-src">${esc(s)}</span>`;
const setFold = (title, src, body, open = true) => `<details class="bs-fold"${open ? ' open' : ''}><summary>${esc(title)} ${src ? setSrc(src) : ''}</summary>${body}</details>`;
const setTable = (tbl) => (!tbl || !tbl.rows.length) ? setEmpty()
  : `<table class="chain-table"><thead><tr>${tbl.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>`
    + tbl.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
const ENG_INFO = [];
const engHelp = (name, desc) => { ENG_INFO.push({ name, desc }); return `<button class="eng-help${desc ? '' : ' st-nohelp'}" data-ei="${ENG_INFO.length - 1}" title="${esc(t('eng.what'))}">?</button>`; };

/* Вкладка «Проект»: собирает generate.js → settings.project. Браузер ничего не пишет. */
function projectSettingsHtml(p){
  if (!p || !p.present) return `<div class="chain-clean">${t('eng.project.missing')}</div>`;
  const ready = p.goals.filter(g => !g.draft), draft = p.goals.filter(g => g.draft);
  const epics = p.epics && p.epics.rows.length ? `<table class="chain-table"><thead><tr><th>${t('eng.th.epic')}</th><th>${t('eng.th.function')}</th><th>${t('eng.th.route')}</th></tr></thead><tbody>${p.epics.rows.map(r =>
    `<tr><td style="white-space:nowrap"><b>${esc(r[1])}</b></td><td class="set-wide">${esc(r[2])}</td><td>${setPill(r[3], 'set-route')}</td></tr>`).join('')}</tbody></table>` : setEmpty();
  return `<section class="chain-section">
    <h2 class="eyebrow">${t('eng.project.title')} · <code>project/config/PROJECT.md</code></h2>
    <div class="bs-tiles">
      ${setTile(esc(p.language || '—'), t('eng.project.language'))}
      ${setTile(esc(p.thresholds.attempts || '—'), t('eng.project.attempts'))}
      ${setTile(esc(p.thresholds.volume || '—'), t('eng.project.volume'))}
      ${setTile(esc(p.release || '—'), t('eng.project.release'))}
      ${setTile(ready.length + ' / ' + draft.length, t('eng.project.goals'), draft.length ? 'warn' : 'ok')}
    </div>
    <p class="set-line">${t('eng.project.template')}: <b>${p.template.name ? esc(p.template.name) : '—'}</b> ${p.template.status ? setPill(p.template.status, 'set-warn') : ''}</p>
    ${setFold(t('eng.project.epics'), '«Эпики проекта»', epics /* i18n-keep: имя секции PROJECT.md */)}
    ${setFold(t('eng.project.goalsFold'), 'project/goals/goal-*/GOAL.md', `<div class="set-pills">${ready.map(g => setPill(g.id, 'set-ok', t('eng.project.ready'))).join('')}${draft.map(g => setPill(g.id, 'set-warn', t('eng.project.draft'))).join('')}${p.goals.length ? '' : setEmpty()}</div>`)}
    ${setFold(t('eng.project.services'), '«Внешние сервисы»' /* i18n-keep */, setTable(p.services) + (p.services && !p.services.rows.length ? `<span class="set-src">${t('eng.project.noThird')}</span>` : ''))}
    ${setFold(t('eng.project.tooling'), '«Оснастка узлов»' /* i18n-keep */, setTable(p.tooling))}
    ${setFold(t('eng.project.references'), '«Справочники проекта»' /* i18n-keep */, setTable(p.references))}
    ${setFold(t('eng.project.skills', {n: p.skills ? p.skills.rows.length : 0}), t('eng.project.skillsSrc'), setTable(p.skills), false)}
  </section>`;
}

/* Вкладка «Движок»: собирает generate.js → settings.engine. Браузер ничего не пишет. */
function engineSettingsHtml(e){
  if (!e || !e.present) return `<div class="chain-clean">${t('eng.engine.missing')}</div>`;
  ENG_INFO.length = 0;
  const c = e.check || {};
  const hookCmds = e.hooks.reduce((n, h) => n + h.commands.length, 0);
  const mcpN = e.mcp.project.reduce((n, p) => n + (p.servers ? p.servers.length : 0), 0) + e.mcp.user.length + e.mcp.userProject.length;
  const checkTile = !c.ran ? setTile('—', t('eng.check.notRun'), 'warn')
    : c.ok ? setTile(t('eng.check.clean'), t('eng.check.label'), 'ok') : setTile(t('eng.check.breach'), t('eng.check.code', {code: esc(String(c.exitCode))}), 'bad');
  const reasons = c.reasons && c.reasons.length
    ? setFold(`${c.ok ? t('eng.check.notes') : t('eng.check.breaches')}: ${c.reasons.length}`, c.command || 'node .claude/scripts/sync-engines.cjs --check',
        '<ul class="set-list">' + c.reasons.map(r => `<li>${esc(r)}</li>`).join('') + '</ul>', !c.ok) : '';
  const descs = e.hookDescs || {};
  const hooks = e.hooks.length ? `<div class="set-hooks">${e.hooks.map(h => `<div class="set-hook">
      <div class="set-hook-h"><b>${esc(h.event)}</b>${h.matcher ? setPill(h.matcher, '', 'matcher') : `<span class="dim">${t('eng.hooks.any')}</span>`}</div>
      <ol class="set-chain">${h.commands.map(cmd => `<li><code>${esc(cmd.replace(/^\.claude\/hooks\//, ''))}</code>${engHelp(cmd, descs[cmd])}</li>`).join('')}</ol></div>`).join('')}</div>` : setEmpty();
  const nodes = e.nodes.length ? `<table class="chain-table"><thead><tr><th>${t('eng.th.node')}</th><th>${t('eng.th.model')}</th><th>${t('eng.th.effort')}</th><th>${t('eng.th.tools')}</th></tr></thead><tbody>${e.nodes.map(n =>
    `<tr><td><b>${esc(n.name)}</b>${engHelp(n.name, t('eng.nodes.tools', {list: n.tools.join(', ')}))}</td><td>${n.model ? setPill(n.model) : setEmpty()}</td><td>${n.effort ? esc(n.effort) : setEmpty()}</td><td>${n.tools.length}</td></tr>`).join('')}</tbody></table>
    <p class="set-src">${t('eng.nodes.foot')}</p>` : setEmpty();
  const pills = (a, cls = '') => a && a.length ? `<div class="set-pills">${a.map(x => setPill(x, cls)).join('')}</div>` : `<span class="dim">${t('eng.none')}</span>`;
  const mcp = `<p class="set-line">${t('eng.mcp.project')}:</p>${e.mcp.project.map(p => `<div class="set-line dim"><code>${esc(p.file)}</code> ${p.servers ? pills(p.servers, 'set-ok') : `<span class="set-empty">${t('eng.mcp.noFile')}</span>`}</div>`).join('')}
    <p class="set-line">${t('eng.mcp.user')} ${setSrc('~/.claude.json')}:</p>${pills(e.mcp.user)}
    ${e.mcp.userProject.length ? `<p class="set-line">${t('eng.mcp.userProject')}:</p>${pills(e.mcp.userProject)}` : ''}`;
  const env = e.env.length ? `<div class="set-pills">${e.env.map(v => setPill(v.hidden ? v.name + ' = ' + t('eng.env.hidden') : v.name + ' = ' + v.value)).join('')}</div>` : setEmpty();
  return `<section class="chain-section">
    <h2 class="eyebrow">${t('eng.engine.title')} · <code>.claude/settings.json</code></h2>
    <div class="bs-tiles">
      ${checkTile}
      ${setTile(e.hooks.length + ' / ' + hookCmds, t('eng.tile.hooks'))}
      ${setTile(e.nodes.length, t('eng.tile.nodes'))}
      ${setTile(e.skills.length, t('eng.tile.skills'))}
      ${setTile(mcpN, t('eng.tile.mcp'))}
    </div>
    ${reasons}
    ${setFold(t('eng.fold.hooks'), '.claude/settings.json · hooks', hooks)}
    ${setFold(t('eng.fold.nodes'), '.claude/agents/*.md', nodes)}
    ${setFold(t('eng.fold.mcp'), '.mcp.json · ~/.claude.json', mcp)}
    ${setFold(t('eng.fold.skills'), '.claude/skills/', pills(e.skills))}
    ${setFold(t('eng.fold.env'), '.claude/settings.json · env', env)}
    ${setFold(t('eng.fold.routes'), e.routes && e.routes.source, routesCatalogHtml(e.routes, setEmpty(), setSrc), false)}
  </section>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.eng-help'); if (!b) return;
  const n = ENG_INFO[+b.dataset.ei], d = document.getElementById('dlg');
  d.innerHTML = `<div class="st-pop"><h3>${esc(n.name)}</h3><p>${n.desc ? esc(n.desc) : `<span class="dim">${t('eng.noDesc')}</span>`}</p><button onclick="document.getElementById('dlg').close()">${t('eng.close')}</button></div>`;
  if (d.open) d.close();
  d.showModal();
});

/* все 13 кодов из ROUTES.md — всё, что есть в движке; без вкл/выкл и настроек проекта. */
function routesCatalogHtml(r, EMPTY, src){
  if (!r) return '';
  const head = `<h3 class="eyebrow">${t('eng.routes.title')} ${src((r.source || '') + ' · ' + t('eng.routes.tables'))}</h3>`;
  if (r.missing) return head + `<span class="set-empty">${t('eng.routes.missing')}</span>`;
  const cell = (list) => (Array.isArray(list) ? list : (list ? [{ text: list }] : []))
    .map(i => `<div style="margin:0 0 4px">${i.label ? `<b>${esc(i.label)}:</b> ` : ''}${esc(i.text)}</div>`).join('');
  const td = 'style="vertical-align:top;white-space:normal;overflow-wrap:anywhere"';
  const row = (x, mid) => `<tr><td ${td}>${esc(x.code)}</td><td ${td}>${esc(x.name)}</td><td ${td}>${mid}</td><td ${td}>${cell(x.risks)}</td><td ${td}>${cell(x.where)}</td></tr>`;
  const rows = r.routes.map(x => row(x, esc(x.chain)))
    .concat(r.overlays.map(x => row(x, t('eng.routes.changes') + ': ' + esc(x.changes))));
  return head + (rows.length ? `<table class="chain-table" style="width:100%;table-layout:fixed"><colgroup><col style="width:8%"><col style="width:14%"><col style="width:20%"><col style="width:29%"><col style="width:29%"></colgroup><thead><tr><th>${t('eng.th.code')}</th><th>${t('eng.th.name')}</th><th>${t('eng.th.chain')}</th><th>${t('eng.th.risks')}</th><th>${t('eng.th.where')}</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : EMPTY);
}
