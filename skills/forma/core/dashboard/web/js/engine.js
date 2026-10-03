// Вкладки «Проект» и «Движок» в настройках: только показ; каталог маршрутов.

/* Общие кирпичи: плитка, плашка, таблица, сворачиваемый раздел. */
const SET_EMPTY = '<span class="set-empty">не заполнено</span>';
const setTile = (num, lbl, cls = '') => `<div class="bs-tile ${cls}"><b>${num}</b><span>${lbl}</span></div>`;
const setPill = (t, cls = '', title = '') => `<span class="set-pill ${cls}"${title ? ` title="${esc(title)}"` : ''}>${esc(t)}</span>`;
const setSrc = (s) => `<span class="set-src">${esc(s)}</span>`;
const setFold = (title, src, body, open = true) => `<details class="bs-fold"${open ? ' open' : ''}><summary>${esc(title)} ${src ? setSrc(src) : ''}</summary>${body}</details>`;
const setTable = (t) => (!t || !t.rows.length) ? SET_EMPTY
  : `<table class="chain-table"><thead><tr>${t.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>`
    + t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
const ENG_INFO = [];
const engHelp = (name, desc) => { ENG_INFO.push({ name, desc }); return `<button class="eng-help${desc ? '' : ' st-nohelp'}" data-ei="${ENG_INFO.length - 1}" title="что это">?</button>`; };

/* Вкладка «Проект»: собирает generate.js → settings.project. Браузер ничего не пишет. */
function projectSettingsHtml(p){
  if (!p || !p.present) return '<div class="chain-clean">project/PROJECT.md не найден.</div>';
  const ready = p.goals.filter(g => !g.draft), draft = p.goals.filter(g => g.draft);
  const epics = p.epics && p.epics.rows.length ? `<table class="chain-table"><thead><tr><th>Эпик</th><th>Функционал</th><th>Маршрут</th></tr></thead><tbody>${p.epics.rows.map(r =>
    `<tr><td style="white-space:nowrap"><b>${esc(r[1])}</b></td><td class="set-wide">${esc(r[2])}</td><td>${setPill(r[3], 'set-route')}</td></tr>`).join('')}</tbody></table>` : SET_EMPTY;
  return `<section class="chain-section">
    <h2 class="eyebrow">Проект · только чтение · <code>project/PROJECT.md</code></h2>
    <div class="bs-tiles">
      ${setTile(esc(p.language || '—'), 'язык проекта')}
      ${setTile(esc(p.thresholds.attempts || '—'), 'порог: заходов на задачу')}
      ${setTile(esc(p.thresholds.volume || '—'), 'порог: объём круга на эпик')}
      ${setTile(esc(p.release || '—'), 'коммитов в dev на версию протокола')}
      ${setTile(ready.length + ' / ' + draft.length, 'цели: готовы / черновик', draft.length ? 'warn' : 'ok')}
    </div>
    <p class="set-line">Шаблон: <b>${p.template.name ? esc(p.template.name) : '—'}</b> ${p.template.status ? setPill(p.template.status, 'set-warn') : ''}</p>
    ${setFold('Эпики проекта', '«Эпики проекта»', epics)}
    ${setFold('Цели', 'project/goals/goal-*/GOAL.md', `<div class="set-pills">${ready.map(g => setPill(g.id, 'set-ok', 'готова')).join('')}${draft.map(g => setPill(g.id, 'set-warn', 'черновик')).join('')}${p.goals.length ? '' : SET_EMPTY}</div>`)}
    ${setFold('Внешние сервисы', '«Внешние сервисы»', setTable(p.services) + (p.services && !p.services.rows.length ? '<span class="set-src">третьего предела нет</span>' : ''))}
    ${setFold('Оснастка узлов', '«Оснастка узлов»', setTable(p.tooling))}
    ${setFold('Справочники', '«Справочники проекта»', setTable(p.references))}
    ${setFold('Умения проекта (' + (p.skills ? p.skills.rows.length : 0) + ')', 'каталог скиллов движка', setTable(p.skills), false)}
  </section>`;
}

/* Вкладка «Движок»: собирает generate.js → settings.engine. Браузер ничего не пишет. */
function engineSettingsHtml(e){
  if (!e || !e.present) return '<div class="chain-clean">.claude/settings.json не найден.</div>';
  ENG_INFO.length = 0;
  const c = e.check || {};
  const hookCmds = e.hooks.reduce((n, h) => n + h.commands.length, 0);
  const mcpN = e.mcp.project.reduce((n, p) => n + (p.servers ? p.servers.length : 0), 0) + e.mcp.user.length + e.mcp.userProject.length;
  const checkTile = !c.ran ? setTile('—', 'сверка сред не запускалась', 'warn')
    : c.ok ? setTile('чисто', 'сверка сред', 'ok') : setTile('нарушение', 'сверка сред: код ' + esc(String(c.exitCode)), 'bad');
  const reasons = c.reasons && c.reasons.length
    ? setFold(`${c.ok ? 'Замечания сверки (не нарушения)' : 'Нарушения'}: ${c.reasons.length}`, c.command || 'node .claude/scripts/sync-engines.cjs --check',
        '<ul class="set-list">' + c.reasons.map(r => `<li>${esc(r)}</li>`).join('') + '</ul>', !c.ok) : '';
  const descs = e.hookDescs || {};
  const hooks = e.hooks.length ? `<div class="set-hooks">${e.hooks.map(h => `<div class="set-hook">
      <div class="set-hook-h"><b>${esc(h.event)}</b>${h.matcher ? setPill(h.matcher, '', 'matcher') : '<span class="dim">любой вызов</span>'}</div>
      <ol class="set-chain">${h.commands.map(cmd => `<li><code>${esc(cmd.replace(/^\.claude\/hooks\//, ''))}</code>${engHelp(cmd, descs[cmd])}</li>`).join('')}</ol></div>`).join('')}</div>` : SET_EMPTY;
  const nodes = e.nodes.length ? `<table class="chain-table"><thead><tr><th>Узел</th><th>Модель</th><th>Усилие</th><th>Инструментов</th></tr></thead><tbody>${e.nodes.map(n =>
    `<tr><td><b>${esc(n.name)}</b>${engHelp(n.name, 'Инструменты: ' + n.tools.join(', '))}</td><td>${n.model ? setPill(n.model) : SET_EMPTY}</td><td>${n.effort ? esc(n.effort) : SET_EMPTY}</td><td>${n.tools.length}</td></tr>`).join('')}</tbody></table>
    <p class="set-src">Нагрузка по инструментам и роль каждого узла — вкладка «Форма».</p>` : SET_EMPTY;
  const pills = (a, cls = '') => a && a.length ? `<div class="set-pills">${a.map(x => setPill(x, cls)).join('')}</div>` : '<span class="dim">нет</span>';
  const mcp = `<p class="set-line">Проектные:</p>${e.mcp.project.map(p => `<div class="set-line dim"><code>${esc(p.file)}</code> ${p.servers ? pills(p.servers, 'set-ok') : '<span class="set-empty">файла нет</span>'}</div>`).join('')}
    <p class="set-line">Пользовательские ${setSrc('~/.claude.json')}:</p>${pills(e.mcp.user)}
    ${e.mcp.userProject.length ? `<p class="set-line">Пользовательские для этого проекта:</p>${pills(e.mcp.userProject)}` : ''}`;
  const env = e.env.length ? `<div class="set-pills">${e.env.map(v => setPill(v.hidden ? v.name + ' = скрыто (запрет 15)' : v.name + ' = ' + v.value)).join('')}</div>` : SET_EMPTY;
  return `<section class="chain-section">
    <h2 class="eyebrow">Движок · только чтение · <code>.claude/settings.json</code></h2>
    <div class="bs-tiles">
      ${checkTile}
      ${setTile(e.hooks.length + ' / ' + hookCmds, 'событий хуков / команд')}
      ${setTile(e.nodes.length, 'узлов')}
      ${setTile(e.skills.length, 'скиллов проекта')}
      ${setTile(mcpN, 'MCP-серверов')}
    </div>
    ${reasons}
    ${setFold('Хуки', '.claude/settings.json · hooks', hooks)}
    ${setFold('Узлы', '.claude/agents/*.md', nodes)}
    ${setFold('MCP-серверы (только имена)', '.mcp.json · ~/.claude.json', mcp)}
    ${setFold('Скиллы проекта', '.claude/skills/', pills(e.skills))}
    ${setFold('Переменные окружения', '.claude/settings.json · env', env)}
    ${setFold('Маршруты и надстройки', e.routes && e.routes.source, routesCatalogHtml(e.routes, SET_EMPTY, setSrc), false)}
  </section>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.eng-help'); if (!b) return;
  const n = ENG_INFO[+b.dataset.ei], d = document.getElementById('dlg');
  d.innerHTML = `<div class="st-pop"><h3>${esc(n.name)}</h3><p>${n.desc ? esc(n.desc) : '<span class="dim">описания нет</span>'}</p><button onclick="document.getElementById('dlg').close()">закрыть</button></div>`;
  if (d.open) d.close();
  d.showModal();
});

/* все 13 кодов из ROUTES.md — всё, что есть в движке; без вкл/выкл и настроек проекта. */
function routesCatalogHtml(r, EMPTY, src){
  if (!r) return '';
  const head = `<h3 class="eyebrow">Маршруты и надстройки ${src((r.source || '') + ' · таблицы «Код»')}</h3>`;
  if (r.missing) return head + '<span class="set-empty">файл не найден</span>';
  const cell = (list) => (Array.isArray(list) ? list : (list ? [{ text: list }] : []))
    .map(i => `<div style="margin:0 0 4px">${i.label ? `<b>${esc(i.label)}:</b> ` : ''}${esc(i.text)}</div>`).join('');
  const td = 'style="vertical-align:top;white-space:normal;overflow-wrap:anywhere"';
  const row = (x, mid) => `<tr><td ${td}>${esc(x.code)}</td><td ${td}>${esc(x.name)}</td><td ${td}>${mid}</td><td ${td}>${cell(x.risks)}</td><td ${td}>${cell(x.where)}</td></tr>`;
  const rows = r.routes.map(x => row(x, esc(x.chain)))
    .concat(r.overlays.map(x => row(x, 'меняет: ' + esc(x.changes))));
  return head + (rows.length ? `<table class="chain-table" style="width:100%;table-layout:fixed"><colgroup><col style="width:8%"><col style="width:14%"><col style="width:20%"><col style="width:29%"><col style="width:29%"></colgroup><thead><tr><th>Код</th><th>Название</th><th>Цепочка / меняет</th><th>Риски</th><th>Где выгоден</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : EMPTY);
}
