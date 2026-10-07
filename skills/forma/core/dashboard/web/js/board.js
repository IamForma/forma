// Вкладка «Доска»: карточки, фильтры, окна карточки, цели и эпика. boardInit вызывается на каждый срез данных.
// Состояние одного вызова — объект B: { DATA, S (выбор на доске), byCode, dependents, linkLaw }; функции bd* берут его первым параметром.
// В конце boardInit подключается «Закон» (law.js), которому нужны подписи и маршруты доски.

// --- Подписи доски: коды (route-N, backlog, stage, why) не переводятся, переводится только их показ ---
const BOARD_T = {
  card: n => t('board.card', {n}), route: n => t('board.route', {n}), over: n => t('board.over', {n}), seg: n => t('board.seg', {n}), wave: n => t('board.wave', {n}),
  get noGoal() { return t('board.noGoal'); }, get trial() { return t('board.trial'); }, get demo() { return t('board.demo'); },
  get status() { return bdKeyed('board.status.', ['backlog', 'todo', 'in-progress', 'review', 'done']); },
  get stage() { return bdKeyed('board.stage.', ['card', 'approve', 'kit', 'exec', 'check', 'accept', 'close', 'closed']); },
  get why() { return bdKeyed('board.why.', ['human', 'ready', 'scale', 'risk', 'decision', 'tooling']); },
};
const bdKeyed = (prefix, keys) => Object.fromEntries(keys.map(k => [k, t(prefix + k)]));
const bdStatuses = () => STATUS_ORDER.map(s => [s, t('board.col.' + s), STATUS_VAR[s]]);
const BOARD_ACTIVE = new Set(['todo','in-progress','review']);
const BOARD_DONE_LIMIT = 5;
// Единицы снаряжения: ключ — как в карточке (язык проекта), показ — из словаря.
const BOARD_UNITS = [['Роль', 'role'], ['Скилл', 'skill'], ['Инструмент', 'tool'], ['Доступ', 'access'], ['Данные', 'data'], ['Модель', 'model']]; // i18n-keep: имена полей из карточки
const BOARD_NODE_C = { Intent: '--accent', Spec: '--st-backlog', Kit: '--st-todo', Run: '--st-progress', Core: '--st-review' };
// Маршруты (.forma/manual/…/ROUTES.md): этапы с ключом, по которому статус карточки ставит флажок «вы здесь». Тексты — из словаря.
const BOARD_ROUTE_DEF = {
  'route-0': ['route0', [['card','Intent','card'],['approve','@human','approve5'],['exec','Intent','execSelf'],['check','Intent','checkFact'],['accept','@human','accept'],['close','Core','closeCycle']]],
  'route-1': ['route1', [['card','Intent','card'],['approve','@human','approve'],['exec','@copy','exec'],['check','Intent','check'],['accept','@human','accept'],['close','Core','closeCycle']]],
  'route-2': ['route2', [['card','Intent','cardKit'],['approve','@human','approve'],['exec','Run','exec'],['check','Intent','check'],['accept','@human','accept'],['close','Core','closeCycle']]],
  'route-3': ['route3', [['card','Intent','question'],['approve','@human','approve'],['exec','Kit','gather'],['check','Intent','sumDecision'],['accept','@human','acceptDecision'],['close','Core','closeCycle']]],
  'route-4': ['route4', [['card','Intent','card'],['approve','@human','approve'],['exec','Kit','kitExec'],['check','Intent','check'],['accept','@human','accept'],['close','Core','closeCycle']]],
  'route-5': ['route5', [['card','Intent','card'],['approve','@human','approve'],['kit','Kit','kit'],['exec','Run','exec'],['check','Intent','check'],['accept','@human','accept'],['close','Core','closeCycle']]],
  'route-6': ['route6', [['card','Spec','slice'],['exec','Run','exec'],['check','Intent','check'],['accept','@human','accept'],['close','Core','closeCycle']]],
  'route-7': ['route7', [['card','Spec','slice'],['kit','Kit','kit'],['exec','Run','exec'],['check','Intent','check'],['accept','@human','accept'],['close','Core','closeCycle']]],
  'route-8': ['route8', [['card','Spec','sliceSeg'],['kit','Kit','kitWave'],['exec','Run','exec'],['check','Intent','check'],['accept','@human','accept'],['close','Core','closeCycle']]],
};
let bdRoutesMemo = null;
function boardRoutes() {
  const lang = curLang();
  if (!bdRoutesMemo || bdRoutesMemo.lang !== lang) {
    const actor = a => a === '@human' ? t('board.actor.human') : a === '@copy' ? t('board.actor.copy') : a;
    bdRoutesMemo = { lang, map: Object.fromEntries(Object.entries(BOARD_ROUTE_DEF).map(([k, [d, steps]]) => [k, [t('board.rt.' + d), steps.map(([st, a, x]) => [st, actor(a), t('board.step.' + x)])]])) };
  }
  return bdRoutesMemo.map;
}

// Код карточки и цели в данных прежний (card-NNN, goal-<код>); на доске — подпись.
const bdCl = code => String(code).replace(/^card-(\d+)$/, (_, n) => BOARD_T.card(n));
const bdGl = (B, g) => g ? (B.DATA.goals[g] ? B.DATA.goals[g].split('·').pop().trim() : g) : BOARD_T.noGoal;
const bdLbl = l => { if (!l) return '—'; const m = l.match(/^(route|over|seg|wave)-(\d+)$/); return m ? BOARD_T[m[1]](m[2]) : l === 'trial' ? BOARD_T.trial : l === 'demo' ? BOARD_T.demo : l; };
// Этап и причина — из строк истории (AGENTS.md §6): последняя «stage <ключ>», все «route … (why: <код>)».
const bdStageLine = c => { let k = null; c.history.forEach(l => { const m = l.match(/:\s*stage\s+(\w+)/); if (m) k = m[1]; }); return k; };
const bdWhyCodes = c => c.history.map(l => l.match(/:\s*route (route-\d[^(—]*)\(why:\s*(\w+)\)/)).filter(Boolean).map(m => [m[1].trim(), m[2]]);
const bdGoalName = (B, g) => g ? (B.DATA.goals[g] ? `${g} · ${B.DATA.goals[g].split('·').pop().trim()}` : g) : t('board.noGoal');
const bdFmtTok = n => new Intl.NumberFormat(curLang(), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const bdFmtSec = s => s >= 3600 ? hhmm(s) : t('time.m', { m: Math.round(s / 60) });
const bdWho = l => (l.match(/^`?(\w+)`?,/) || [, ''])[1];

// --- Выбор на доске: читается из localStorage, пишется при каждой перерисовке ---
function bdLoadState() {
  const S = {group:'status', state:'active', goal:null, epic:null, assignee:null, route:null, q:'', openDone:{}, view:'.forma/board'};
  try { Object.assign(S, JSON.parse(localStorage.getItem('boardDemo') || '{}'), {openDone:{}}); if (!['ready', 'notReady'].includes(S.rdy)) delete S.rdy; } catch { /* выбор не сохранялся или localStorage закрыт — остаются значения по умолчанию */ }
  return S;
}
function bdSave(B) { try { localStorage.setItem('boardDemo', JSON.stringify({...B.S, openDone:undefined})); } catch { /* localStorage закрыт — выбор не запомнится */ } }
function bdBase(B) {
  const S = B.S;
  // Поиск ищет по всей доске: «Показ» при нём не действует; число — это номер карточки.
  const q = S.q.trim().toLowerCase(), num = q.match(/^(?:card-)?(\d{1,3})$/);
  return B.DATA.cards.filter(c =>
    (q || S.state === 'all' || (S.state === 'active' ? BOARD_ACTIVE.has(c.status) : S.state === 'open' ? c.status !== 'done' : c.status === S.state)) &&
    (!q || (num ? c.code === 'card-' + num[1].padStart(3, '0') : (c.code + ' ' + c.title + ' ' + c.criterion + ' ' + c.delivers).toLowerCase().includes(q))));
}
function bdApply(B, list, skip) {
  const S = B.S;
  if (S.q.trim()) return list; // поиск — по всей доске, фильтры при нём не действуют
  return list.filter(c =>
    (skip === 'goal' || !S.goal || (c.goal || '—') === S.goal) &&
    (skip === 'epic' || !S.epic || c.epic === S.epic) &&
    (skip === 'assignee' || !S.assignee || String(c.assignee) === S.assignee) &&
    (skip === 'route' || !S.route || (c.route || '—') === S.route) &&
    (skip === 'rdy' || !S.rdy || (bdIsReady(c) ? 'ready' : 'notReady') === S.rdy));
}
// Ряд чипов одного фильтра. o: { el, label, key, getter, fmt } — элемент, подпись, ключ в S, значение у карточки, показ значения.
function bdChips(B, o) {
  const { el, label, key, getter, fmt = x => x } = o, S = B.S;
  const counts = {};
  bdApply(B, bdBase(B), key).forEach(c => { const v = getter(c); counts[v] = (counts[v] || 0) + 1; });
  const keys = Object.keys(counts).sort();
  el.innerHTML = `<b>${label}</b>` + [`<span class="chip ${!S[key]?'on':''}" data-v="">${t('board.all')}</span>`, ...keys.map(k =>
    `<span class="chip ${S[key]===k?'on':''}" data-v="${esc(k)}">${esc(fmt(k))}<span class="n">${counts[k]}</span></span>`)].join('');
  el.onclick = e => { const ch = e.target.closest('.chip'); if (!ch) return; S[key] = ch.dataset.v || null; bdRender(B); };
}

// --- Схема зависимостей: слева то, чего ждёт карточка (рекурсивно), в центре она, справа — кто ждёт её ---
function bdDepLevels(B, code) {
  const level = { [code]: 0 }, edges = [];
  const walk = (c, dir, seen) => {
    const next = dir < 0 ? (B.byCode[c]?.ready.deps || []) : (B.dependents[c] || []);
    next.forEach(n => {
      edges.push(dir < 0 ? [n, c] : [c, n]);
      if (seen.has(n)) return; seen.add(n);
      level[n] = dir < 0 ? Math.min(level[n] ?? 0, level[c] - 1) : Math.max(level[n] ?? 0, level[c] + 1);
      walk(n, dir, seen);
    });
  };
  walk(code, -1, new Set([code])); walk(code, 1, new Set([code]));
  return { level, uniq: [...new Map(edges.map(e => [e.join('>'), e])).values()] };
}
function bdDepLayout(level) {
  const cols = {};
  Object.entries(level).forEach(([k, l]) => (cols[l] ||= []).push(k));
  const lv = Object.keys(cols).map(Number).sort((a, b) => a - b);
  const W = 190, H = 58, GX = 60, GY = 14, pos = {};
  const maxRows = Math.max(...lv.map(l => cols[l].length));
  lv.forEach((l, i) => cols[l].sort().forEach((k, j) => {
    const off = (maxRows - cols[l].length) * (H + GY) / 2;
    pos[k] = { x: 10 + i * (W + GX), y: 10 + off + j * (H + GY) };
  }));
  return { pos, W, H, w: 20 + lv.length * W + (lv.length - 1) * GX, h: 20 + maxRows * H + (maxRows - 1) * GY };
}
function bdDepLines(B, uniq, g) {
  const { pos, W, H } = g;
  return uniq.map(([a, b]) => {
    const A = pos[a], P = pos[b]; if (!A || !P) return '';
    const x1 = A.x + W, y1 = A.y + H / 2, x2 = P.x, y2 = P.y + H / 2, mx = (x1 + x2) / 2;
    const done = B.byCode[a]?.status === 'done';
    return `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 6},${y2}" fill="none" stroke="${done ? 'var(--st-done)' : 'var(--ink-faint)'}" stroke-width="1.6" ${done ? '' : 'stroke-dasharray="4 3"'} marker-end="url(#arr)"/>`;
  }).join('');
}
function bdDepNodes(B, code, g) {
  const { pos, W, H } = g;
  const stColor = s => `var(${(bdStatuses().find(x => x[0] === s) || bdStatuses()[0])[2]})`;
  return Object.keys(pos).map(k => {
    const c = B.byCode[k], P = pos[k], me = k === code;
    const title = c ? c.title : t('board.cardNotFound');
    const short = title.length > 48 ? title.slice(0, 46) + '…' : title;
    return `<g class="gnode" data-code="${k}" transform="translate(${P.x},${P.y})">
      <rect width="${W}" height="${H}" rx="8" fill="var(--surface)" stroke="${me ? 'var(--accent)' : 'var(--border)'}" stroke-width="${me ? 2 : 1}"/>
      <rect width="4" height="${H}" rx="2" fill="${c ? stColor(c.status) : '#C0392B'}"/>
      <text x="12" y="17" font-size="11" font-family="ui-monospace,monospace" fill="var(--ink-faint)">${k} · ${esc(c?.status || '?')}</text>
      <foreignObject x="10" y="21" width="${W - 16}" height="${H - 24}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:11.5px;line-height:1.25;color:var(--ink)">${esc(short)}</div></foreignObject>
    </g>`;
  }).join('');
}
function bdDepGraph(B, code) {
  const { level, uniq } = bdDepLevels(B, code);
  const g = bdDepLayout(level), { w, h } = g;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" style="max-width:100%;height:auto;display:block">
    <defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink-faint)"/></marker></defs>${bdDepLines(B, uniq, g)}${bdDepNodes(B, code, g)}</svg>`;
}

// --- Окна карточки: зависимости, снаряжение, расход, маршрут, цель, эпик, сама карточка ---
function bdOpenDeps(B, code) {
  const c = B.byCode[code], d = document.getElementById('dlg');
  d.dataset.code = code;
  if (d.open) d.close();
  const related = [...new Set([...(c.ready.deps || []), ...(B.dependents[code] || [])])];
  const row = k => { const x = B.byCode[k]; if (!x) return `<li>${k} — ${t('board.notOnBoard')}</li>`;
    const role = t(c.ready.deps.includes(k) ? 'board.waitingForIt' : 'board.waitsForUs');
    return `<li><a href="#" data-open="${k}">${k}</a> · <b>${esc(x.status)}</b> · ${role} — ${esc(x.title)}<br><small>${esc((x.delivers || '').slice(0, 180))}</small></li>`; };
  d.innerHTML = `<button onclick="this.closest('dialog').close()">✕</button><div class="code">${t('board.dlg.deps')} · ${bdCl(code)}</div><h2>${esc(c.title)}</h2>
    <p class="meta">${t('board.depsMeta')}</p>
    <div class="graph">${bdDepGraph(B, code)}</div><ul class="rel">${related.map(row).join('')}</ul>`;
  d.showModal();
}
function bdOpenKit(B, code) {
  const c = B.byCode[code], d = document.getElementById('dlg');
  d.dataset.code = code; if (d.open) d.close();
  const rows = BOARD_UNITS.map(([u, id]) => {
    const v = c.kitParts[u];
    let extra = '';
    if (u === 'Скилл' /* i18n-keep */ && c.kitSkills.length) extra = '<ul class="rel">' + c.kitSkills.map(s =>
      `<li><b>${esc(s)}</b> — <small>${esc(B.DATA.skills[s] || '')}</small></li>`).join('') + '</ul>';
    return `<tr><th>${t('board.unit.' + id)}<br><small>${t('board.unit.' + id + '.hint')}</small></th><td>${v ? esc(v) : `<span class="miss">${t('board.notSet')}</span>`}${extra}</td></tr>`;
  }).join('');
  d.innerHTML = `<button onclick="this.closest('dialog').close()">✕</button><div class="code">${t('board.dlg.kit')} · ${bdCl(code)}</div><h2>${esc(c.title)}</h2>
    <p class="meta">${t('board.kitMeta')}</p>
    <table class="kitt">${rows}</table>`;
  d.showModal();
}
function bdSpendEngineRows(s) {
  return Object.entries(s.byEngine || {}).map(([k, E]) => `<tr><th>${t('board.sp.tokens', { e: esc(engineLabel(k)) })}</th><td>${E.tokens.toLocaleString(curLang())} <small class="dim">${t('board.sp.attempts', { n: E.lines })}${E.unknown ? t('board.sp.noNumber', { n: E.unknown }) : ''}</small></td></tr>
    <tr><th>${t('board.sp.cache', { e: esc(engineLabel(k)) })}</th><td>${E.cache.toLocaleString(curLang())}${E.mixed ? '' : ` (${E.tokens ? Math.round(E.cache / E.tokens * 100) : 0}%)`} — ${t('board.sp.cacheNote')}</td></tr>
    ${E.mixed ? `<tr><th>${t('board.sp.warn', { e: esc(engineLabel(k)) })}</th><td class="miss">${t('board.sp.mixed')}</td></tr>`
      : `<tr><th>${t('board.sp.work', { e: esc(engineLabel(k)) })}</th><td>${Math.max(0, E.tokens - E.cache).toLocaleString(curLang())}</td></tr>`}`).join('');
}
function bdOpenSpend(B, code) {
  const c = B.byCode[code], d = document.getElementById('dlg'), s = c.spend;
  d.dataset.code = code; if (d.open) d.close();
  const lines = (c.historySpend || []).map(l => `<li><small>${esc(l)}</small></li>`).join('');
  d.innerHTML = `<button onclick="this.closest('dialog').close()">✕</button><div class="code">${t('board.dlg.spend')} · ${bdCl(code)}</div><h2>${esc(c.title)}</h2>
    <table class="kitt"><tr><th>${t('board.sp.recorded')}</th><td>${s.lines}${s.unknown ? t('board.sp.ofUnnumbered', { n: s.unknown }) : ''}</td></tr>
    ${bdSpendEngineRows(s)}
    ${Object.keys(s.byEngine || {}).length > 1 ? `<tr><th>${t('board.sp.engines')}</th><td class="dim">${t('board.sp.enginesNote')}</td></tr>` : ''}
    ${s.unknown ? `<tr><th>${t('board.sp.unnumbered')}</th><td class="miss">${t('board.sp.unnumberedNote', { n: s.unknown })}</td></tr>` : ''}
    <tr><th>${t('board.sp.time')}</th><td>${bdFmtSec(s.sec)}</td></tr></table><ul class="rel">${lines}</ul>`;
  d.showModal();
}

// --- Готовность карточки и плашки на ней ---
// бюджет важен до исполнения; на review/done израсходованные попытки — норма
const bdBudgetOut = c => ['backlog','todo','in-progress'].includes(c.status) && c.ready.budgetLeft !== null && c.ready.budgetLeft <= 0;
const bdIsReady = c => { const r = c.ready; return r.goal && r.task && r.kit && r.route && r.approval !== false &&
  r.access !== false && r.access !== 'unknown' && !r.depsOpen.length && !bdBudgetOut(c); };
function bdPips(B, c) {
  const r = c.ready, k = r.kitUnits.length, dependents = B.dependents;
  const p = (ok, txt, title) => `<span class="pip ${ok}" title="${esc(title)}">${txt}</span>`;
  return `<div class="pips">${p(r.goal?'ok':'no',t('board.pip.goal'),t('board.pip.goalTip'))}${p(r.task?'ok':'no',t('board.pip.task'),t('board.pip.taskTip'))}` +
    `${p((k===6?'ok':k?'half':'no')+' kitp',t('board.pip.kit',{k}),t('board.pip.kitTip',{units: r.kitUnits.join(', ') || t('board.none')}))}${p(r.route?'ok':'no',t('board.pip.route'),t('board.pip.routeTip'))}` +
    (r.approval === null ? '' : p(r.approval?'ok':'no',t('board.pip.approval'),t('board.pip.approvalTip'))) +
    (r.access === null ? '' : p(r.access===true?'ok':r.access==='unknown'?'half':'no',r.access==='unknown'?t('board.pip.accessUnk'):t('board.pip.access'),
      r.access==='unknown'?t('board.pip.accessUnkTip'):t('board.pip.accessTip'))) +
    (r.budgetLeft === null ? '' : p(bdBudgetOut(c)?'no':'ok',r.budgetLeft < 0 ? t('board.pip.attemptsOver',{n:-r.budgetLeft}) : t('board.pip.attempts',{n:r.budgetLeft}),
      r.budgetLeft < 0 ? t('board.pip.overTip',{n:-r.budgetLeft}) : t('board.pip.leftTip'))) +
    (r.deps.length ? p(r.depsOpen.length?'no dep':'ok dep',t('board.pip.deps',{a:r.deps.length-r.depsOpen.length,b:r.deps.length}),
      (r.depsOpen.length ? t('board.pip.depsWait',{list:r.depsOpen.join(', ')}) : t('board.pip.depsOk')) + ' — ' + t('board.pip.schemeHint'))
      : dependents[c.code] ? p('half dep',t('board.pip.waiters',{n:dependents[c.code].length}),t('board.pip.waitersTip',{list:dependents[c.code].join(', ')}) + ' — ' + t('board.pip.schemeHint')) : '') +
    (c.spend.lines ? p('cost spendp',t('board.pip.spend',{v:Object.entries(c.spend.byEngine || {}).map(([k, E]) => bdFmtTok(E.tokens) + (Object.keys(c.spend.byEngine).length > 1 ? ' ' + engineLabel(k) : '')).join(' · ')}),t('board.pip.spendTip',{n:c.spend.lines})) : '') + '</div>';
}
function bdCardHtml(B, c) {
  const st = bdStatuses().find(s => s[0] === c.status) || bdStatuses()[0];
  return `<div class="card" style="--c:var(${st[2]})" data-code="${c.code}">
    <div class="code" title="${c.code}">${bdCl(c.code)} · ${esc(c.kind)} · ${esc(c.assignee ?? '—')}</div>
    <div class="t">${esc(c.title)}</div>
    <div class="tags"><span class="tag goal click goalt" title="${esc(c.goal || '')}">${esc(bdGl(B, c.goal))}</span><span class="tag click epict">${esc(c.epic)}</span>${c.route ? `<span class="tag click routet" title="${c.route}">${bdLbl(c.route)}</span>` : ''}${c.labels.filter(l => /^(over|seg|wave)-|^(trial|demo)$/.test(l)).map(l => `<span class="tag" title="${l}">${bdLbl(l)}</span>`).join('')}</div>
    ${bdPips(B, c)}${bdWaitHtml(B, c)}
  </div>`;
}
function bdColumns(B, list, laneKey) {
  const S = B.S;
  const visible = bdStatuses().filter(([s]) => S.q.trim() ? true : S.state === 'all' || S.state === 'open' ? (S.state === 'all' || s !== 'done') : S.state === 'active' ? BOARD_ACTIVE.has(s) : s === S.state);
  return `<div class="cols" style="grid-template-columns:repeat(${visible.length},minmax(200px,1fr))">` + visible.map(([s, name, v]) => {
    let items = list.filter(c => c.status === s);
    const total = items.length, dk = laneKey + s;
    if (s === 'done' && !S.openDone[dk] && total > BOARD_DONE_LIMIT) items = items.slice(0, BOARD_DONE_LIMIT);
    return `<div class="col" style="--c:var(${v})"><h3><span>${name}</span><span>${total}</span></h3><div class="col-list" data-sk="${esc(dk)}">` +
      (items.map(c => bdCardHtml(B, c)).join('') || `<div class="empty">${t('board.empty')}</div>`) +
      (items.length < total ? `<div class="more" data-dk="${esc(dk)}">${t('board.more', { n: total - items.length })}</div>` : '') + '</div></div>';
  }).join('') + '</div>';
}
// Пилюли целей: всего карточек цели и разбивка по статусам (фильтры кроме цели и «Показа» учтены).
function bdGoalPill(S, id, name, list) {
  const n = bdStatuses().map(([s]) => list.filter(c => c.status === s).length), t = list.length;
  return `<span class="gpill ${(id ? S.goal === id : !S.goal) ? 'on' : ''} ${t ? '' : 'zero'}" data-v="${esc(id)}" title="${esc(bdStatuses().map(([, nm], i) => nm + ': ' + n[i]).join(' · '))}">` +
    `<span class="top"><span>${esc(name)}</span><b>${t}</b></span>` +
    `<span class="gbar">${n.map((v, i) => v ? `<span style="width:${v / (t || 1) * 100}%;background:var(${bdStatuses()[i][2]})"></span>` : '').join('')}</span>` +
    `<span class="gnums">${n.map((v, i) => `<i class="${v ? '' : 'z'}" style="--c:var(${bdStatuses()[i][2]})">${v}</i>`).join('')}</span></span>`;
}
// Тумблер «Канбан ⇄ Цели» стоит на месте слова «Цель»: вид «Цели» — бывшая вкладка «Цепь» (chain.js).
const bdKbToggle = (S) => `<span class="kb-toggle" role="group" aria-label="${t('board.kbAria')}">
  <button type="button" class="kb-opt ${(S.view||'.forma/board')==='.forma/board'?'on':''}" data-kb=".forma/board">${t('board.kb')}</button>
  <button type="button" class="kb-opt ${(S.view||'.forma/board')==='goals'?'on':''}" data-kb="goals">${t('board.goals')}</button>
</span>`;
function bdGoalPills(B, el) {
  const { DATA, S } = B, q = S.q.toLowerCase();
  const pool = bdApply(B, DATA.cards.filter(c => !q || (c.code + ' ' + c.title + ' ' + c.criterion + ' ' + c.delivers).toLowerCase().includes(q)), 'goal');
  const ids = [...new Set([...Object.keys(DATA.goals), ...pool.map(c => c.goal || '—')])].sort();
  el.innerHTML = bdKbToggle(S) + bdGoalPill(S, '', t('board.allCap'), pool) + ids.map(id =>
    bdGoalPill(S, id, id === '—' ? t('board.noGoal') : (DATA.goals[id] || id).split('·').pop().trim(), pool.filter(c => (c.goal || '—') === id))).join('');
  el.onclick = e => {
    const kb = e.target.closest('.kb-opt'); if (kb) { S.view = kb.dataset.kb; bdRender(B); return; }
    const p = e.target.closest('.gpill'); if (!p) return; S.goal = p.dataset.v || null; bdRender(B);
  };
}
// Переключение вида внутри «Канбана»: доска колонок или «Цели» (бывшая «Цепь»).
function bdApplyView(B) {
  const v = B.S.view || '.forma/board';
  const main = document.getElementById('main'), goals = document.getElementById('view-goals');
  if (main) main.hidden = v === 'goals';
  if (goals) goals.hidden = v !== 'goals';
}

// --- Перерисовка доски: фильтры, сводка, колонки или дорожки ---
function bdRenderFilters(B) {
  const S = B.S, byId = id => document.getElementById(id);
  byId('group').innerHTML = ['status','goal','epic','assignee'].map(k =>
    `<span class="chip ${S.group===k?'on':''}" data-g="${k}">${t('board.g.' + k)}</span>`).join(' ');
  const st = byId('f-state');
  st.innerHTML = `<b>${t('board.show')}</b>` + ['all','active','open','backlog','done'].map(k =>
    `<span class="chip ${S.state===k?'on':''}" data-v="${k}">${t('board.s.' + k)}</span>`).join('');
  st.onclick = e => { const ch = e.target.closest('.chip'); if (ch) { S.state = ch.dataset.v; bdRender(B); } };
  bdGoalPills(B, byId('f-goal'));
  bdChips(B, { el: byId('f-epic'), label: t('board.f.epic'), key: 'epic', getter: c => c.epic });
  bdChips(B, { el: byId('f-assignee'), label: t('board.f.node'), key: 'assignee', getter: c => String(c.assignee), fmt: x => x === 'null' ? t('board.closed') : x });
  bdChips(B, { el: byId('f-route'), label: t('board.f.route'), key: 'route', getter: c => c.route || '—', fmt: bdLbl });
  bdChips(B, { el: byId('f-rdy'), label: t('board.f.rdy'), key: 'rdy', getter: c => bdIsReady(c) ? 'ready' : 'notReady', fmt: x => t('board.rdy.' + x) });
}
function bdRenderSummary(B, list) {
  const S = B.S;
  document.getElementById('qn').textContent = S.q ? t('board.found', { n: list.length }) : '';
  document.getElementById('stats').innerHTML = bdStatuses().map(([s, n, v]) =>
    `<div class="stat" style="--c:var(${v})"><strong>${bdApply(B, B.DATA.cards.filter(c => c.status === s))
      .filter(c => !S.q || (c.code + ' ' + c.title).toLowerCase().includes(S.q.toLowerCase())).length}</strong><span>${n}</span></div>`).join('');

  const grpName = t('board.g.' + S.group);
  const stName = S.state === 'active' ? t('board.s.activeShort') : t('board.s.' + S.state);
  const sum = [[t('board.slice'), grpName], [t('board.show'), stName], [t('board.f.epic'), S.epic || t('board.all')], [t('board.f.node'), S.assignee ? (S.assignee === 'null' ? t('board.closed') : S.assignee) : t('board.all')],
    [t('board.f.route'), S.route ? bdLbl(S.route) : t('board.all')], [t('board.f.rdy'), S.rdy ? t('board.rdy.' + S.rdy) : t('board.all')]];
  const bs = document.getElementById('bar-sum');
  bs.innerHTML = sum.map(([k, v]) => `<span class="sel-k">${k}</span><span class="chip on" data-k="${k}">${esc(v)}</span>`).join('');
  bs.title = sum.map(([k, v]) => k + ': ' + v).join(' · ');
}
function bdRenderMain(B, list) {
  const S = B.S, main = document.getElementById('main');
  // Прокрутка колонок и доски переживает перерисовку (SSE, фильтры).
  const keep = { main: main.scrollTop }; main.querySelectorAll('.col-list').forEach(el => keep[el.dataset.sk] = el.scrollTop);
  const restore = () => { main.scrollTop = keep.main; main.querySelectorAll('.col-list').forEach(el => { if (keep[el.dataset.sk]) el.scrollTop = keep[el.dataset.sk]; }); };
  if (S.group === 'status') { main.innerHTML = bdColumns(B, list, 'all'); restore(); return; }
  const key = { goal: c => c.goal || '—', epic: c => c.epic, assignee: c => String(c.assignee) }[S.group];
  const lanes = {};
  list.forEach(c => (lanes[key(c)] ||= []).push(c));
  const names = Object.keys(lanes).sort();
  main.innerHTML = names.map(n => `<section class="lane"><h2>${esc(S.group === 'goal' ? bdGoalName(B, n) : n === 'null' ? t('board.closed') : n)} <small>${lanes[n].length}</small></h2>${bdColumns(B, lanes[n], n)}</section>`).join('')
    || `<p class="empty">${t('board.nothing')}</p>`;
  restore();
}
function bdRender(B) {
  bdSave(B);
  bdApplyView(B);
  bdRenderFilters(B);
  const list = bdApply(B, bdBase(B));
  bdRenderSummary(B, list);
  bdRenderMain(B, list);
}

// --- Этап и ожидание карточки ---
function bdStageNow(c) {
  const w = bdStageLine(c); if (w && BOARD_T.stage[w]) return w === 'close' && c.assignee == null ? 'closed' : w;
  const st = (boardRoutes()[c.route] || [])[1] || [], has = k => st.some(s => s[0] === k);
  if (c.status === 'backlog') return c.ready.approval === false ? 'approve' : c.ready.task ? (has('approve') ? (has('kit') ? 'kit' : 'exec') : has('kit') ? 'kit' : 'exec') : 'card';
  if (c.status === 'todo') return has('kit') ? 'kit' : 'exec';
  if (c.status === 'in-progress') return 'exec';
  if (c.status === 'review') return 'check';
  return c.assignee === 'Core' ? 'close' : 'closed';
}
const bdAccepted = (B, epic) => B.DATA.cards.filter(c => c.epic === epic && c.status === 'done' && c.assignee === 'Core').length;
// Чего ждёт карточка, чтобы двинуться: первая преграда по порядку маршрута.
function bdWaiting(B, c) {
  const r = c.ready;
  if (c.status === 'done') return c.assignee === 'Core'
    ? ['flow', t('board.w.core', { acc: bdAccepted(B, c.epic), of: B.DATA.thresholds.volume ? t('board.w.of', { v: B.DATA.thresholds.volume }) : '' })] : null;
  if (c.humanFlag) return ['human', t('board.w.human')];
  if (!r.task) return ['blocked', t('board.w.task')];
  if (!r.goal) return ['human', t('board.w.goal')];
  if (!r.route) return ['blocked', t('board.w.route')];
  if (r.approval === false) return ['human', t('board.w.approve')];
  if (r.depsOpen.length) return ['blocked', t('board.w.deps', { list: r.depsOpen.join(', ') })];
  if (bdBudgetOut(c)) return ['blocked', t('board.w.budget')];
  if (c.status === 'review') return ['human', t('board.w.review')];
  if (r.access === false || r.access === 'unknown') return ['blocked', t('board.w.access')];
  if (!r.kit && c.status !== 'in-progress') return ['flow', t('board.w.kit', { k: r.kitUnits.length })];
  if (c.status === 'in-progress') return ['flow', t('board.w.inWork', { who: c.assignee || '—' })];
  return ['flow', t(c.status === 'todo' ? 'board.w.readyKit' : 'board.w.readyTake')];
}
const bdWaitHtml = (B, c) => { const w = bdWaiting(B, c); return w ? `<div class="wait ${w[0]}">⏳ ${esc(w[1])}</div>` : ''; };
const bdDlgOpen = (B, code, html) => { const d = document.getElementById('dlg'); d.dataset.code = code || ''; if (d.open) d.close();
  d.innerHTML = `<button onclick="this.closest('dialog').close()">✕</button>` + B.linkLaw(html); d.showModal(); };
const bdCardRow = o => `<li><a href="#" data-open="${o.code}" title="${o.code}">${bdCl(o.code)}</a> ${esc(o.title)} <small>· ${esc(BOARD_T.status[o.status] || o.status)} · ${esc(o.assignee ?? t('board.closed'))}</small></li>`;
function bdRouteHtml(c) {
  const R = boardRoutes()[c.route]; if (!R) return `<p class="miss">${t('board.routeNone')}</p>`;
  const now = bdStageNow(c), exact = !!bdStageLine(c), idx = R[1].findIndex(s => s[0] === now), all = now === 'closed';
  const hist = k => ({ approve: /одобрил|approved/i, check: /провер|review/i, accept: /принят|accepted/i })[k]; // i18n-keep: слова из истории карточки
  const dateOf = k => { const re = hist(k); if (!re) return ''; const l = c.history.find(x => re.test(x)); const m = l && l.match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : ''; };
  return `<div class="route">${R[1].map((s, i) => `${i ? '<span class="arrow">→</span>' : ''}<div class="stage ${all || i < idx ? 'done' : i === idx ? 'now' : ''}"${i === idx && !all ? ` data-here="${esc(t('board.here'))}"` : ''}>${all || i < idx ? '✓ ' : ''}${esc(s[1])}<small>${esc(s[2])}${dateOf(s[0]) ? ' · ' + dateOf(s[0]) : ''}</small></div>`).join('')}</div>
    <p class="meta">${bdLbl(c.route)} <small>(${c.route})</small> — ${esc(R[0])}. ${t('board.now')} <b>${BOARD_T.stage[now] || now}</b> ${exact ? `<small>${t('board.nowRecorded')}</small>` : `<small class="miss">${t('board.nowGuess', { s: BOARD_T.status[c.status] || c.status })}</small>`}</p>`;
}
function bdOpenRoute(B, code) {
  const c = B.byCode[code]; if (!c) return;
  const why = c.history.filter(l => /route-\d|маршрут/i.test(l)); // i18n-keep
  const over = c.labels.filter(l => /^over-\d$/.test(l));
  const w = bdWaiting(B, c);
  bdDlgOpen(B, code, `<div class="code">${t('board.dlg.route')} · ${bdCl(code)}</div><h2>${esc(c.title)}</h2>${bdRouteHtml(c)}
    ${w ? `<div class="wait ${w[0]}">⏳ ${esc(w[1])}</div>` : ''}
    <dl>${over.length ? `<dt>${t('board.overlays')}</dt><dd>${over.join(', ')}</dd>` : ''}
    <dt>${t('board.whyCode')}</dt><dd>${bdWhyCodes(c).length ? bdWhyCodes(c).map(([r, k]) => `${esc(bdLbl(r.split(' ')[0]))}${r.includes('→') ? ' → ' + esc(bdLbl(r.split('→')[1].trim())) : ''}: <b>${esc(BOARD_T.why[k] || k)}</b> <small>(${esc(k)})</small>`).join('<br>') : `<span class="miss">${t('board.noWhy')}</span>`}</dd>
    <dt>${t('board.routeLines')}</dt><dd>${why.length ? '<ul class="rel">' + why.map(l => `<li><small>${esc(l)}</small></li>`).join('') + '</ul>' : `<span class="miss">${t('board.whyMissing')}</span>`}</dd></dl>`);
}
function bdOpenGoal(B, g) {
  const DATA = B.DATA, gi = DATA.goalInfo[g] || {}, list = DATA.cards.filter(c => (c.goal || '—') === (g || '—'));
  const n = bdStatuses().map(([s, nm]) => `${nm} ${list.filter(c => c.status === s).length}`).join(' · ');
  bdDlgOpen(B, '', `<div class="code">${t('board.dlg.goal')} · ${esc(g || t('board.noGoal'))}</div><h2>${esc(g ? bdGoalName(B, g) : t('board.noGoalCards'))}</h2>
    <dl><dt>${t('board.image')}</dt><dd>${gi.image ? esc(gi.image) : '—'}${gi.draft ? ` <span class="miss">${t('board.draft')}</span>` : ''}</dd>
    <dt>${t('board.closer')}</dt><dd>${esc(gi.closer || '—')}</dd><dt>${t('board.cardsN', { n: list.length })}</dt><dd>${n}</dd></dl>
    <ul class="rel">${list.filter(c => c.status !== 'done').map(bdCardRow).join('') || `<li>${t('board.noOpen')}</li>`}</ul>`);
}
function bdOpenEpic(B, e) {
  const list = B.DATA.cards.filter(c => c.epic === e), acc = bdAccepted(B, e), v = B.DATA.thresholds.volume;
  bdDlgOpen(B, '', `<div class="code">${t('board.dlg.epic')}</div><h2>${esc(e)}</h2>
    <dl><dt>${t('board.cycle')}</dt><dd>${t('board.cycleText', { acc, of: v ? t('board.cycleOf', { v }) : '', closed: list.filter(c => c.status === 'done' && c.assignee == null).length })}</dd>
    <dt>${t('board.epicRoute')}</dt><dd>${/\/Intent\+Kit/.test(e) ? t('board.epicShort') : t('board.epicSpec')}</dd>
    <dt>${t('board.byStatus')}</dt><dd>${bdStatuses().map(([s, nm]) => `${nm} ${list.filter(c => c.status === s).length}`).join(' · ')}</dd></dl>
    <ul class="rel">${list.filter(c => c.status !== 'done').map(bdCardRow).join('') || `<li>${t('board.noOpen')}</li>`}</ul>`);
}
function bdCardLinks(B, c) {
  return [
    c.mentions.length ? `<dt>${t('board.mentions')}</dt><dd><ul class="rel">${c.mentions.map(m => B.byCode[m] ? bdCardRow(B.byCode[m]) : `<li>${m}</li>`).join('')}</ul></dd>` : '',
    B.dependents[c.code] ? `<dt>${t('board.waiters')}</dt><dd>${B.dependents[c.code].map(x => `<a href="#" data-open="${x}">${x}</a>`).join(', ')}</dd>` : '',
    c.adrs.length ? `<dt>ADR</dt><dd>${c.adrs.map(esc).join(', ')}</dd>` : '',
    c.commits.length ? `<dt>${t('board.commits', { n: c.commits.length })}</dt><dd><ul class="rel">${c.commits.map(([h, d, s]) => `<li><code>${esc(h)}</code> ${esc(d)} <small>${esc(s)}</small></li>`).join('')}</ul></dd>` : '',
    c.materials.length ? `<dt>${t('board.materials', { code: c.code })}</dt><dd>${c.materials.map(esc).join(', ')}</dd>` : '',
  ].join('');
}
function bdOpenCard(B, code) {
  const c = B.byCode[code]; if (!c) return;
  const r = c.ready, w = bdWaiting(B, c), left = r.budgetLeft;
  const tl = c.history.map(l => `<li style="--c:var(${BOARD_NODE_C[bdWho(l)] || '--ink-faint'})"><small>${esc(l)}</small></li>`).join('');
  bdDlgOpen(B, code, `<div class="code" title="${c.code}">${bdCl(c.code)} · ${esc(BOARD_T.status[c.status] || c.status)} · ${esc(c.assignee ?? t('board.closed'))}</div><h2>${esc(c.title)}</h2>
    ${w ? `<div class="wait ${w[0]}">⏳ ${esc(w[1])}</div>` : ''}
    <dl><dt>${t('board.routeMore', { code: c.code })}</dt><dd>${bdRouteHtml(c)}</dd>
    <dt>${t('board.readiness')}</dt><dd>${t(bdIsReady(c) ? 'board.rdy.ready' : 'board.rdy.notReady')}${bdPips(B, c)}</dd><dt>${t('board.kind')}</dt><dd>${esc(c.kind)}</dd><dt>${t('board.delivers')}</dt><dd>${esc(c.delivers)}</dd><dt>${t('board.criterion')}</dt><dd>${esc(c.criterion)}</dd>
    <dt>${t('board.attempts')}</dt><dd>${t('board.att.text', { b: esc(c.budget), n: c.attempts })}${left === null ? '' : left < 0 ? t('board.att.over', { n: -left }) : t('board.att.left', { n: left })}${B.DATA.thresholds.attempts ? t('board.att.cap', { n: B.DATA.thresholds.attempts }) : ''}</dd>
    <dt>${t('board.next')}</dt><dd>${esc(c.next)}</dd>
    <dt>${t('board.glm')}</dt><dd><a href="#" data-goal="${esc(c.goal || '')}">${esc(bdGoalName(B, c.goal))}</a> · <a href="#" data-epic="${esc(c.epic)}">${esc(c.epic)}</a> · ${c.labels.map(esc).join(', ')}</dd>
    ${bdCardLinks(B, c)}
    <dt>${t('board.history', { n: c.history.length })}</dt><dd><ul class="tl">${tl || `<li>${t('board.empty')}</li>`}</ul></dd></dl>`);
}

// --- События: переключатель среза, поиск, клики по доске и по окну карточки ---
function bdBindMain(B) {
  document.getElementById('main').onclick = e => {
    const more = e.target.closest('.more');
    if (more) { B.S.openDone[more.dataset.dk] = true; bdRender(B); return; }
    const el = e.target.closest('.card'); if (!el) return;
    if (e.target.closest('.dep')) { bdOpenDeps(B, el.dataset.code); return; }
    if (e.target.closest('.routet')) { bdOpenRoute(B, el.dataset.code); return; }
    if (e.target.closest('.goalt')) { bdOpenGoal(B, B.byCode[el.dataset.code].goal); return; }
    if (e.target.closest('.epict')) { bdOpenEpic(B, B.byCode[el.dataset.code].epic); return; }
    if (e.target.closest('.kitp')) { bdOpenKit(B, el.dataset.code); return; }
    if (e.target.closest('.spendp')) { bdOpenSpend(B, el.dataset.code); return; }
    bdOpenCard(B, el.dataset.code);
  };
}
function bdBindDialog(B) {
  document.getElementById('dlg').onclick = e => {
    const g = e.target.closest('[data-goal]'); if (g) { e.preventDefault(); bdOpenGoal(B, g.dataset.goal); return; }
    const ep = e.target.closest('[data-epic]'); if (ep) { e.preventDefault(); bdOpenEpic(B, ep.dataset.epic); return; }
    const rt = e.target.closest('[data-route]'); if (rt) { e.preventDefault(); bdOpenRoute(B, rt.dataset.route); return; }
    const t = e.target.closest('[data-open], .gnode, .dep, .kitp, .spendp'); if (!t) return;
    e.preventDefault();
    const code = t.dataset.open || t.dataset.code || document.getElementById('dlg').dataset.code;
    if (t.classList.contains('dep')) bdOpenDeps(B, code); else if (t.classList.contains('kitp')) bdOpenKit(B, code); else if (t.classList.contains('spendp')) bdOpenSpend(B, code); else bdOpenCard(B, code);
  };
}
function bdBindSearch(B) {
  document.getElementById('group').onclick = e => { const ch = e.target.closest('.chip'); if (ch) { B.S.group = ch.dataset.g; bdRender(B); } };
  document.getElementById('q').oninput = e => { B.S.q = e.target.value; bdRender(B); };
  document.getElementById('q').onkeydown = e => {
    if (e.key !== 'Enter') return;
    const v = e.target.value.trim().toLowerCase(), n = v.match(/^(?:card-)?(\d{1,3})$/);
    const hit = n ? B.DATA.cards.find(c => c.code === 'card-' + n[1].padStart(3, '0'))
      : B.DATA.cards.find(c => (c.code + ' ' + c.title).toLowerCase().includes(v));
    if (hit) bdOpenCard(B, hit.code);
  };
}

// --- Доска и Закон ---
function boardInit(DATA) {
  const B = { DATA, S: bdLoadState(), byCode: Object.fromEntries(DATA.cards.map(c => [c.code, c])), dependents: {}, linkLaw: null };
  DATA.cards.forEach(c => c.ready.deps.forEach(d => (B.dependents[d] ||= []).push(c.code)));
  bdBindSearch(B); bdBindMain(B); bdBindDialog(B);
  document.getElementById('proj').textContent = t('board.project', { name: DATA.project });
  document.title = t('board.docTitle', { name: DATA.project });
  document.getElementById('q').value = B.S.q;
  document.getElementById('gen').textContent = t('board.generated', { d: new Date(DATA.generated).toLocaleString(curLang()), n: DATA.cards.length });
  bdRender(B);
  B.linkLaw = lawInit({ DATA, esc, T: BOARD_T, lbl: bdLbl, ROUTES: boardRoutes() }).linkLaw;
}

// Панель фильтров доски: выбор человека (открыта/свёрнута) — в localStorage; прокрутка вниз сворачивает, наверх — возвращает выбор.
(function(){
  var bar=document.getElementById('bar'), btn=document.getElementById('bar-toggle'), K='boardBarOpen', open=false, auto=false;
  try{ open=localStorage.getItem(K)==='1'; }catch(e){ /* localStorage закрыт — панель открывается свёрнутой */ }
  function show(){ var o=open&&!auto; bar.classList.toggle('collapsed',!o); btn.textContent=t('board.filters')+(o?' ▴':' ▾'); btn.setAttribute('aria-expanded',o); }
  btn.onclick=function(){ if(auto){ auto=false; open=true; } else open=!open; try{ localStorage.setItem(K,open?'1':'0'); }catch(e){ /* localStorage закрыт — выбор не запомнится */ } show(); };
  // Страница доски не крутится — слушаем прокрутку любого списка карточек и самой доски (capture: scroll не всплывает).
  document.addEventListener('scroll',function(e){ var t=e.target, y=(t===document||t===document.documentElement)?scrollY:t.scrollTop; if(t!==document&&t!==document.documentElement&&!(t.id==='main'||t.classList&&t.classList.contains('col-list')))return; if(y>160&&!auto&&open){ auto=true; show(); } else if(y<20&&auto){ auto=false; show(); } },{passive:true,capture:true});
  new ResizeObserver(function(){ document.documentElement.style.setProperty('--bh',bar.offsetHeight+'px'); }).observe(bar);
  show();
  document.addEventListener('i18n',show);
})();
