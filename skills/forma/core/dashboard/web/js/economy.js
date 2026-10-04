// Вкладка «Экономика»: пять уровней от ключевых метрик к справке, по одобренному макету.
// Уровень 1 — пять плиток, уровень 2 — динамика и структура, уровень 3 — где уходят токены,
// уровень 4 — деньги/движки/субагенты (свёрнуто), уровень 5 — справка и аудит (свёрнуто).
// Блоки уровней 3-5 переиспользуют существующие функции разбора без изменения их тел.
// Все строки интерфейса — через t()/cnt() из словарей locales/*.json, ключи `econ.*`.
// Внимание: локальные переменные не называть `t` — это перевод.

function tilesHtml(tot, dialog){
  // Три статьи расхода (AGENTS.md §3): узлы по `## История`, диалог Intent ↔ человек
  // по стенограмме основной сессии (работа без кэш-чтения), и их сумма.
  // Токены по узлам и «всего» здесь не стоят: они сложены из разных движков —
  // по движкам см. таблицу выше. Диалог — стенограмма одного движка (claude-code).
  const dlg = dialog && dialog.all ? dialog.all.work : 0;
  const tiles = [
    {num:tot.epicCount, lbl:t('econ.tile.epics')},
    {num:tot.cardCount, lbl:t('econ.tile.cards')},
    {num:tot.attemptCount, lbl:t('econ.tile.attempts'), pending:tot.attemptCount===0},
    ...(dialog ? [{num:dlg, lbl:t('econ.tile.dialog'), pending:!dlg}] : []),
  ];
  return `<section class="tiles">${tiles.map(x => `
    <div class="tile ${x.pending?'pending':''}">
      <div class="num">${x.pending ? '—' : fmt(x.num)}</div>
      <div class="lbl">${x.lbl}</div>
    </div>`).join('')}</section>`;
}

// Длинная подсказка `.hint` — пряталась плиткой текста на уровнях 3-4 (карточка
// раздувалась). Сворачиваем в «?»; на уровне 5 этой обёрткой не пользуемся — там
// подсказка внутри уже раскрытого блока уместна как есть.
function hintFold(bodyHtml){
  return `<details class="hint-fold"><summary>?</summary>${bodyHtml}</details>`;
}

function barSegments(byStatus, total){
  return STATUS_ORDER.filter(s => byStatus[s]).map(s => {
    const pct = (byStatus[s] / total * 100).toFixed(2);
    return `<span style="width:${pct}%; background:var(${STATUS_VAR[s]})" title="${STATUS_LABEL[s]}: ${byStatus[s]}"></span>`;
  }).join('');
}

function globalBarHtml(totals){
  const legend = STATUS_ORDER.filter(s => totals.byStatus[s]).map(s => `
    <span><span class="dot" style="background:var(${STATUS_VAR[s]})"></span>${STATUS_LABEL[s]} <b>${totals.byStatus[s]}</b></span>
  `).join('');
  return `<section class="statusbar-card">
    <h2>${t('econ.statusAll')}</h2>
    <div class="bar">${barSegments(totals.byStatus, totals.cardCount)}</div>
    <div class="legend">${legend}</div>
  </section>`;
}

const NODE_COLORS = {
  Intent:"#2D7D8C", Spec:"#5B6FD6", Kit:"#B0562E", Run:"#A23B54", Core:"#6E8F3E",
};

function configHtml(nodeConfig){
  if (!nodeConfig || !nodeConfig.length) return '';
  const rows = nodeConfig.map(n => {
    const color = NODE_COLORS[n.node] || "#8891A2";
    const ext = n.externalModel
      ? `<span class="external-yes">${t('econ.yes')}</span>`
      : '<span class="external-no">—</span>';
    return `<tr>
      <td><span class="node-name" style="--node-color:${color}">${n.node}</span></td>
      <td class="mono-cell">${n.model || '—'}</td>
      <td class="mono-cell">${n.effort || '—'}</td>
      <td class="mono-cell">${n.toolCount}</td>
      <td>${ext}</td>
    </tr>`;
  }).join('');
  return `<section class="config-card">
    <h2>${t('econ.config.title')}</h2>
    <table class="config-table">
      <thead><tr><th>${t('econ.th.node')}</th><th>${t('econ.config.model')}</th><th>${t('econ.config.effort')}</th><th>${t('econ.config.tools')}</th><th>${t('econ.config.external')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function dialogRowHtml(dialog, maxTokens){
  const cur = dialog && dialog.current, all = dialog && dialog.all;
  if (!cur && !all) return '';
  const w = all ? all.work : 0;
  const pct = Math.min(100, Math.max(w / maxTokens * 100, w > 0 ? 1.5 : 0));
  const curTxt = cur && cur.sessions
    ? t('econ.dlg.cur', {work: fmt(cur.work), cache: fmt(cur.cacheRead), calls: cur.calls}) + (cur.sessions > 1 ? ' · ' + t('econ.dlg.live', {n: cur.sessions}) : '')
    : t('econ.dlg.curNone');
  const allTxt = all
    ? t('econ.dlg.all', {work: fmt(all.work), cache: fmt(all.cacheRead), sessions: all.sessions, usd: fmt(Math.round(all.usd || 0))}) + (all.ageHours != null && all.ageHours > 24 ? ' · ' + t('econ.dlg.age', {h: Math.round(all.ageHours)}) : '')
    : t('econ.dlg.allNone');
  return `<div class="node-row node-row-dialog" style="--node-color:${NODE_COLORS.Intent || '#8891A2'}" title="${esc(t('econ.dlg.title'))}">
      <span class="node-name">${t('econ.dlg.name')}</span>
      <span class="node-bar-track"><span class="node-bar-fill" style="width:${pct}%"></span></span>
      <span class="node-figures">${curTxt}<br>${allTxt}</span>
    </div>`;
}

function econNodesHtml(byNode, dialog){
  if ((!byNode || !byNode.length) && !(dialog && (dialog.current || dialog.all))) {
    return `<section class="nodes-card">
      <h2>${t('econ.nodesSpend')}</h2>
      <div class="node-empty">${t('econ.nodes.empty')}</div>
    </section>`;
  }
  byNode = byNode || [];
  const maxTokens = Math.max(...byNode.map(n => n.tokensTotal), dialog && dialog.all ? dialog.all.work : 0, 1);
  const rows = byNode.map(n => {
    const color = NODE_COLORS[n.node] || "#8891A2";
    const pct = Math.max((n.tokensTotal / maxTokens * 100), n.tokensTotal > 0 ? 1.5 : 0);
    const money = n.costUsdTotal > 0 ? ` · <b>$${n.costUsdTotal.toFixed(4)}</b> (${t('econ.ext', {n: n.externalAttemptCount})})` : '';
    return `<div class="node-row" style="--node-color:${color}">
      <span class="node-name">${n.node}</span>
      <span class="node-bar-track"><span class="node-bar-fill" style="width:${pct}%"></span></span>
      <span class="node-figures">${t('econ.nodes.figures', {tok: fmt(n.tokensTotal), att: n.attemptCount, cards: n.cardCount})}${money}</span>
    </div>`;
  }).join('');
  return `<section class="nodes-card">
    <h2>${t('econ.nodesSpend')}</h2>
    <div class="node-rows">${rows}${dialogRowHtml(dialog, maxTokens)}</div>
  </section>`;
}

// Компактная панель по образцу трёх панелей Graphify (`graphifyPanelHtml`) — постоянные
// субагенты (живут сквозь много задач, не по одной карточке, `kit.md`-задача «учёт расхода
// постоянных субагентов»). Без точного обратного отсчёта по дням — только мягкое
// предупреждение при простое дольше SUBAGENT_STALE_DAYS-эквивалента (`entry.stale` уже
// посчитан в generate.js, семантика retention не подтверждена документацией однозначно).
function subagentsHtml(list, bare){
  const heading = bare ? '' : `<h2>${t('econ.subagents')}</h2>`;
  if (!list || !list.length) {
    return `<section class="config-card">
      ${heading}
      <div class="node-empty" style="padding:0 18px 16px">${t('econ.subagents.empty')}</div>
    </section>`;
  }
  const rows = list.map(a => {
    const badge = a.stale ? graphifyBadgeHtml(t('econ.subagents.stale', {days: 25})) : '';
    return `<div class="card-row" style="grid-template-columns:8px 1fr auto; align-items:start">
      <span class="status-dot" style="background:${a.stale ? 'var(--st-review)' : 'var(--st-done)'}; margin-top:5px"></span>
      <span>
        <span class="card-title" style="display:block" title="${(a.role||a.agent).replace(/"/g,'&quot;')}"><b class="mono">${a.agent}</b> — ${a.role || t('econ.subagents.noRole')}</span>
        ${badge}
      </span>
      <span class="card-tags mono" style="align-self:flex-start">${t('econ.subagents.figures', {calls: fmt(a.calls), tok: fmt(a.tokensTotal), hired: timeAgo(a.hiredAt), last: timeAgo(a.lastUsedAt)})}</span>
    </div>`;
  }).join('');
  return `<section class="config-card">
    ${heading}
    <div class="epic-list" style="margin-top:6px">${rows}</div>
  </section>`;
}

function moneyHtml(totals, byNode, bare){
  const heading = bare ? `<div class="e-sub-lbl">${t('econ.money')}</div>` : `<h2>${t('econ.money.title')}</h2>`;
  const externalNodes = (byNode || []).filter(n => n.costUsdTotal > 0);
  if (!totals.costUsdTotal) {
    return `<section class="money">
      <div class="money-head">
        ${heading}
        <span class="status-chip">${t('econ.off')}</span>
      </div>
      <div class="money-figure">—</div>
      <p>${t('econ.money.empty')}</p>
    </section>`;
  }
  const rows = externalNodes.map(n => `<div class="card-row" style="grid-template-columns:8px 1fr auto">
    <span class="status-dot" style="background:${NODE_COLORS[n.node] || '#8891A2'}"></span>
    <span class="card-title">${n.node}</span>
    <span class="card-tags mono">$${n.costUsdTotal.toFixed(4)} · ${cnt('count.calls', n.externalAttemptCount)}</span>
  </div>`).join('');
  return `<section class="money">
    <div class="money-head">
      ${heading}
      <span class="status-chip" style="color:var(--st-done); border-color:var(--st-done)">${t('econ.on')}</span>
    </div>
    <div class="money-figure">$${totals.costUsdTotal.toFixed(4)}</div>
    <div class="epic-list" style="margin-top:4px">${rows}</div>
    <p>${t('econ.money.note')}</p>
  </section>`;
}

/* --- Уровень 1: ключевые метрики --------------------------------------------
   Пять плиток, главная — «токенов на закрытую карточку» (мера выгоды, не расхода):
   выгода — закрытая карточка, токены — цена. Дельта и искра — по `efficiency.byDate`
   выбранного движка; одна точка или меньше — «—», не ноль (`AGENTS.md` §5 п.2). */
function heroDeltaHtml(byDate){
  if (!byDate || byDate.length < 2) return '<span class="dim">—</span>';
  const prev = byDate[byDate.length - 2].perCard, last = byDate[byDate.length - 1].perCard;
  if (!prev) return '<span class="dim">—</span>';
  const diff = last - prev;
  if (diff === 0) return `<span class="dim">${t('econ.noChange')}</span>`;
  const p = Math.round(Math.abs(diff) / prev * 100);
  // Меньше — лучше: та же карточка обошлась дешевле.
  return `<span class="delta ${diff < 0 ? 'good' : 'bad'}">${diff < 0 ? '▼' : '▲'} ${t('econ.delta', {p})}</span>`;
}

function sparkHtml(byDate){
  if (!byDate || byDate.length < 2) return '';
  const vals = byDate.slice(-10).map(d => d.perCard);
  const max = Math.max(...vals), min = Math.min(...vals), span = (max - min) || 1;
  const w = 200, h = 34;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - 4 - ((v - min) / span) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lx, ly] = pts[pts.length - 1].split(',');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    <circle cx="${lx}" cy="${ly}" r="3.5" fill="var(--accent)"/></svg>`;
}

function level1Html(d, view){
  const f = view.economy.efficiency || {};
  const tot = view.economy.totals || {};
  const cov = d.economy.coverage || {};
  const totalsAll = d.totals;
  const blind = cov.cardsWorked ? Math.max(0, cov.cardsWorked - cov.cardsWithAttempts) : null;
  const blindPct = cov.cardsWorked ? pct(blind, cov.cardsWorked) : null;
  const tiles = [
    { cls: 'hero', lbl: t('econ.l1.perCard'),
      num: f.cardsCounted ? fmt(f.perCard) : '—',
      sub: f.cardsCounted
        ? heroDeltaHtml(f.byDate) + sparkHtml(f.byDate)
        : `<div class="lbl">${t('econ.l1.perCardNone')}</div>` },
    { cls: '', lbl: t('econ.l1.total'), num: tot.tokens ? fmt(tot.tokens) : '—' },
    { cls: '', lbl: t('econ.l1.cost'),
      num: totalsAll.costUsdTotal ? '$' + totalsAll.costUsdTotal.toFixed(4) : '—',
      sub: `<div class="lbl">${totalsAll.costUsdTotal ? t('econ.l1.costExt') : t('econ.l1.costNone')}</div>` },
    { cls: '', lbl: t('econ.l1.accepted'), num: `${fmt(totalsAll.byStatus.done || 0)} / ${fmt(totalsAll.cardCount)}`,
      sub: `<div class="lbl">${t('econ.l1.attempts', {n: fmt(totalsAll.attemptCount)})}</div>` },
    { cls: 'alert', lbl: t('econ.blindSpots'), num: blindPct != null ? blindPct + '%' : '—',
      sub: `<div class="lbl">${t('econ.l1.blind')}</div>` },
  ];
  return `<div class="tier"><div class="tier-lab">${t('econ.l1.tier')}</div>
    <section class="tiles tiles-hero">${tiles.map(x => `
      <div class="tile kpi ${x.cls}">
        <div class="lbl">${x.lbl}</div>
        <div class="num mono">${x.num}</div>
        ${x.sub || ''}
      </div>`).join('')}</section>
  </div>`;
}

/* --- Уровень 2: динамика и структура -----------------------------------------
   Слева — токены по дням (столбцы) и токены на закрытую карточку по дате закрытия
   (линия); справа — доля инструктажа/работы (`totals.cacheRead`/`totals.work`) и
   перечитывания на токен работы (`sessionEconomy.totals.ratio`), тренд — по `byWeek`. */
function trendChartHtml(byDate, effByDate){
  if (!byDate || !byDate.length) {
    return `<div class="nodata">${t('econ.trend.empty')}</div>`;
  }
  const w = 640, h = 170;
  const gap = (w - 20) / byDate.length;
  const barW = Math.max(6, Math.min(30, gap - 6));
  const maxTok = Math.max(...byDate.map(x => x.tokens), 1);
  const bars = byDate.map((x, i) => {
    const bh = Math.max(2, (x.tokens / maxTok) * (h - 30));
    return `<rect x="${(10 + i * gap).toFixed(1)}" y="${(h - 10 - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="var(--accent)" opacity=".75"><title>${t('econ.trend.bar', {date: x.date, tok: fmt(x.tokens), att: x.attempts})}</title></rect>`;
  }).join('');
  const effMap = Object.fromEntries((effByDate || []).map(x => [x.date, x.perCard]));
  const known = byDate.map(x => effMap[x.date]).filter(v => v != null);
  let line = '';
  if (known.length > 1) {
    const maxL = Math.max(...known), minL = Math.min(...known), span = (maxL - minL) || 1;
    const pts = [];
    byDate.forEach((x, i) => {
      const v = effMap[x.date];
      if (v == null) return;
      const px = 10 + i * gap + barW / 2;
      const py = 10 + (h - 30) - ((v - minL) / span) * (h - 40);
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    });
    const [lx, ly] = pts[pts.length - 1].split(',');
    line = `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--st-progress)" stroke-width="2.5"/><circle cx="${lx}" cy="${ly}" r="4" fill="var(--st-progress)"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(t('econ.trend.aria'))}">
      <g stroke="var(--border)"><line x1="0" y1="20" x2="${w}" y2="20"/><line x1="0" y1="70" x2="${w}" y2="70"/><line x1="0" y1="120" x2="${w}" y2="120"/><line x1="0" y1="160" x2="${w}" y2="160"/></g>
      <g>${bars}</g>${line}
    </svg>
    <p class="hint">${t('econ.trend.bars', {days: cnt('count.days', byDate.length)})}
      ${known.length > 1 ? t('econ.trend.line') : t('econ.trend.noLine')}</p>`;
}

function weeksTrendText(se){
  const weeks = (se.byWeek || []).filter(w => w.ratio != null);
  if (weeks.length < 2) return t('econ.weeks.few');
  const first = weeks[0], last = weeks[weeks.length - 1];
  const vars = {a: first.ratio, wa: first.week, b: last.ratio, wb: last.week};
  return last.ratio > first.ratio ? t('econ.weeks.up', vars) : t('econ.weeks.down', vars);
}

function level2Html(view){
  const e = view.economy, tot = e.totals || {}, c = e.coverage || {};
  const trendCard = `<div class="e-card">
    <h3>${t('econ.l2.trend')}</h3>
    ${trendChartHtml(e.byDate, (e.efficiency || {}).byDate)}
  </div>`;
  const stack = c.attemptsWithCacheRead
    ? (() => {
        const inst = pct(tot.cacheRead, tot.cacheRead + tot.work);
        const work = 100 - inst;
        // Подпись внутри узкого сегмента обрезалась бы контейнером (overflow:hidden
        // на `.stack`) — поэтому полные подписи стоят легендой под полосой, а не в ней.
        return `<div class="stack">
            <span style="width:${inst}%;background:var(--st-review)" title="${t('econ.l2.instr')} ${inst}%"></span>
            <span style="width:${work}%;background:var(--st-done)" title="${t('econ.l2.work')} ${work}%"></span>
          </div>
          <div class="legend stack-legend">
            <span><span class="dot" style="background:var(--st-review)"></span>${t('econ.l2.instr')} <b>${inst}%</b></span>
            <span><span class="dot" style="background:var(--st-done)"></span>${t('econ.l2.work')} <b>${work}%</b></span>
          </div>`;
      })()
    : `<div class="nodata">${t('econ.l2.noInstr')}</div>`;
  const seOk = view.econEngine === 'claude-code' && view.sessionEconomy && !view.sessionEconomy.error;
  const ratioCard = seOk
    ? `<div class="kpi-inline"><div class="lbl">${t('econ.l2.ratio')}</div><div class="num mono">${view.sessionEconomy.totals.ratio}</div><p class="hint">${weeksTrendText(view.sessionEconomy)}</p></div>`
    : `<div class="kpi-inline"><div class="lbl">${t('econ.l2.ratio')}</div><div class="num mono dim">—</div><p class="hint">${view.econEngine === 'claude-code' ? t('econ.l2.noLedger') : t('econ.l2.onlyCC')}</p></div>`;
  const workCard = `<div class="e-card">
    <h3>${t('econ.l2.workTitle')}</h3>
    ${stack}
    ${ratioCard}
  </div>`;
  return `<div class="tier"><div class="tier-lab">${t('econ.l2.tier')}</div>
    <div class="erow erow-2">${trendCard}${workCard}</div>
  </div>`;
}

/* --- Уровень 3: где уходят токены --------------------------------------------
   Переиспользует nodesHtml (переименована в econNodesHtml — коллизия имени с global
   function nodesHtml в nodes.js, тот же глобальный scope, грузится позже и перетирал её)/
   topCardsHtml/routesHtml без изменений — только сетка. */
function level3Html(view, dialog){
  return `<div class="tier"><div class="tier-lab">${t('econ.l3.tier')}</div>
    <div class="erow erow-3">
      ${econNodesHtml(view.byNode, dialog)}
      ${topCardsHtml(view.economy.topCards) || `<div class="e-card"><h3>${t('econ.top.title')}</h3><div class="nodata">${t('econ.top.empty')}</div></div>`}
      ${routesHtml(view.byRoute) || `<div class="e-card"><h3>${t('econ.routes.title')}</h3><div class="nodata">${t('econ.routes.empty')}</div></div>`}
    </div>
  </div>`;
}

/* --- Уровень 4: деньги, движки, постоянные субагенты — свёрнуто по умолчанию открыто -- */
function accDetails(title, body, open){
  return `<details class="e-acc"${open ? ' open' : ''}><summary>${esc(title)}</summary><div class="e-acc-body">${body}</div></details>`;
}

function level4Html(d, view){
  const blocks = [
    [t('econ.l4.services'), servicesHtml(view.economy, true) + moneyHtml(d.totals, d.byNode, true)],
    [t('econ.l4.engines'), engineTableHtml(d.economy.byEngine, true)],
    [t('econ.subagents'), subagentsHtml(d.subagents, true)],
  ];
  return `<div class="tier"><div class="tier-lab">${t('econ.l4.tier')}</div>
    <div class="erow erow-3">${blocks.map(([ttl, b]) => accDetails(ttl, b, true)).join('')}</div>
  </div>`;
}

/* --- Экономика: тело переиспользуемых блоков уровней 3 и 5 ------------------- */

const secText = s => s < 60 ? t('time.s', {s}) : hhmm(s);

function economyNodesHtml(byNode){
  const rows = byNode.filter(n => n.attemptCount).map(n => `<tr>
    <td><b>${n.node}</b></td>
    <td class="n">${n.attemptCount}</td>
    <td class="n">${fmt(n.tokensTotal)}</td>
    <td class="n">${n.avgTokens ? fmt(n.avgTokens) : '—'}</td>
    <td class="n">${n.withSeconds ? secText(n.secondsTotal) : '—'}${n.withSeconds && n.withSeconds < n.attemptCount ? ` <span class="dim">${t('econ.nodes.of', {a: n.withSeconds, b: n.attemptCount})}</span>` : ''}</td>
    <td class="n">${n.avgSeconds ? t('time.s', {s: n.avgSeconds}) : '—'}</td>
    <td class="n">${n.cardCount}</td>
  </tr>`).join('');
  return `<div class="ebox">
    <h3>${t('econ.nodesSpend')}</h3>
    <p class="hint">${t('econ.nodes.avgHint')}</p>
    <table class="etable">
      <thead><tr><th>${t('econ.th.node')}</th><th class="n">${t('econ.th.attempts')}</th><th class="n">${t('econ.th.tokens')}</th><th class="n">${t('econ.th.avgAttempt')}</th>
        <th class="n">${t('econ.th.time')}</th><th class="n">${t('econ.th.avgTime')}</th><th class="n">${t('econ.th.cards')}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="dim">${t('econ.nodes.noAttempts')}</td></tr>`}</tbody>
    </table>
  </div>`;
}

function topCardsHtml(list){
  if (!list || !list.length) return '';
  const max = list[0].tokens || 1;
  // Карточка с нулём токенов — не дешёвая, а незаписанная: в списке «дороже всего»
  // она читалась бы как достижение. Её место в слепых пятнах, и только там.
  list = list.filter(c => c.tokens > 0);
  if (!list.length) return '';
  const rows = list.map(c => `<tr>
    <td class="ttl" title="${esc(c.title)}">${esc(c.title)}</td>
    <td class="n">${fmt(c.tokens)}</td>
    <td style="width:130px"><div class="bar" style="height:8px">
      <span style="width:${pct(c.tokens, max)}%;background:var(--accent)"></span></div></td>
    <td class="n">${c.attempts}</td>
    <td class="n">${hhmm(c.seconds)}</td>
    <td class="dim">${c.nodes.join(' · ')}</td>
  </tr>`).join('');
  return `<div class="e-card">
    <h3>${t('econ.top.title')}</h3>
    ${hintFold(`<p class="hint">${t('econ.top.hint')}</p>`)}
    <div class="etable-scroll"><table class="etable" style="min-width:480px">
      <thead><tr><th>${t('econ.th.card')}</th><th class="n">${t('econ.th.tokens')}</th><th></th><th class="n">${t('econ.th.attempts')}</th>
        <th class="n">${t('econ.th.time')}</th><th>${t('econ.th.nodes')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function blindSpotsHtml(e){
  const b = e.blindSpots, c = e.coverage;
  if (!c.blindSpotCount) return `<div class="nodata">${t('econ.blind.none')}</div>`;
  const rows = b.map(x => `<tr>
    <td class="ttl" title="${esc(x.title)}">${esc(x.title)}</td>
    <td><span class="pill">${esc(x.status)}</span></td>
    <td class="dim">${esc(x.epic || '—')}</td>
  </tr>`).join('');
  return `<h3>${t('econ.blind.title', {cards: cnt('count.cards', c.blindSpotCount)})}</h3>
    <p class="hint">${t('econ.blind.hint')}
       ${b.length < c.blindSpotCount ? t('econ.blind.first', {n: b.length}) : ''}</p>
    <table class="etable">
      <thead><tr><th>${t('econ.th.card')}</th><th>${t('econ.th.status')}</th><th>${t('econ.th.epic')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function daysHtml(byDate){
  if (!byDate.length) return '';
  const max = Math.max(...byDate.map(d => d.tokens)) || 1;
  const bars = byDate.map(d =>
    `<div class="d" style="height:${Math.max(3, pct(d.tokens, max))}%"
      title="${t('econ.days.bar', {date: d.date, tok: fmt(d.tokens), att: d.attempts, time: hhmm(d.seconds)})}"></div>`).join('');
  return `<div class="ebox">
    <h3>${t('econ.days.title')}</h3>
    <p class="hint">${t('econ.days.hint')}</p>
    <div class="days">${bars}</div>
    <div class="days-ax"><span>${byDate[0].date}</span><span>${byDate[byDate.length - 1].date}</span></div>
  </div>`;
}

/* Внешние сервисы — третий род расхода, рядом с токенами и деньгами.
   Каждый считает в своей единице, поэтому в одну сумму они не сводятся и не должны:
   «1740 кредитов и 12 минут» — это два разных факта, а не одно число. */
function servicesHtml(e, bare){
  const heading = bare ? `<div class="e-sub-lbl">${t('econ.svc.sub')}</div>` : `<h3>${t('econ.svc.title')}</h3>`;
  const list = e.byService || [];
  if (!list.length) {
    return `${heading}
      <div class="nodata">${t('econ.svc.empty')}</div>`;
  }
  const blocks = list.map(s => {
    const max = s.operations[0] ? s.operations[0].amount : 1;
    const rows = s.operations.map(o => `<tr>
      <td class="ttl" title="${esc(o.operation)}">${esc(o.operation)}</td>
      <td class="n">${fmt(o.amount)}</td>
      <td style="width:120px"><div class="bar" style="height:8px">
        <span style="width:${pct(o.amount, max)}%;background:var(--st-review)"></span></div></td>
    </tr>`).join('');
    return `<div class="svc">
      <div class="svc-head">
        <span class="svc-name">${esc(s.service)}</span>
        <span class="svc-sum"><b>${fmt(s.amount)}</b> ${esc(s.unit)}</span>
        <span class="dim">${cnt('count.calls', s.calls)} · ${cnt('count.cards', s.cardCount)} · ${s.firstDate}${s.lastDate !== s.firstDate ? ' — ' + s.lastDate : ''}</span>
      </div>
      <table class="etable"><tbody>${rows}</tbody></table>
    </div>`;
  }).join('');
  return `${heading}
    ${hintFold(`<p class="hint">${t('econ.svc.hint')}</p>`)}
    ${blocks}`;
}

// Расход по маршрутам: тот же счёт, что `tally.cjs --routes`.
function routesHtml(r){
  if (!r) return '';
  const unk = x => [x.tokensUnknown && t('econ.routes.unkTokens', {n: x.tokensUnknown}), x.cacheUnknown && `cache-read: ${x.cacheUnknown}`,
    x.secondsUnknown && t('econ.routes.unkSec', {n: x.secondsUnknown})].filter(Boolean).join(', ');
  // Компактно первыми: метка, карточек, токенов, возвратов — остальные колонки
  // (заходов, cache-read, время, подготовка, unknown) доступны прокруткой вправо.
  const rows = list => list.map(x => `<tr>
    <td><b>${x.key}</b></td>
    <td class="n">${x.cards}</td>
    <td class="n">${fmt(x.tokens)}</td>
    <td class="n">${x.returns}</td>
    <td class="n">${x.attempts}</td>
    <td class="n">${fmt(x.cacheRead)}</td>
    <td class="n">${secText(x.seconds)}</td>
    <td class="n">${x.prepShare == null ? `<span class="dim">${t('econ.notRecorded')}</span>` : x.prepShare + '% <span class="dim">(' + x.prepNodes + ')</span>'}</td>
    <td class="dim">${unk(x) || '—'}</td>
  </tr>`).join('');
  const block = (title, list) => list && list.length ? `<tr><th colspan="9">${title}</th></tr>` + rows(list) : '';
  return `<div class="e-card">
    <h3>${t('econ.routes.title')}</h3>
    ${hintFold(`<p class="hint">${t('econ.routes.hint')}</p>`)}
    <div class="etable-scroll"><table class="etable" style="min-width:640px">
      <thead><tr><th>${t('econ.th.label')}</th><th class="n">${t('econ.th.cards')}</th><th class="n">${t('econ.th.tokens')}</th><th class="n">${t('econ.th.returns')}</th>
        <th class="n">${t('econ.th.attempts')}</th><th class="n">Cache-read</th><th class="n">${t('econ.th.time')}</th><th class="n">${t('econ.th.prep')}</th><th>Unknown</th></tr></thead>
      <tbody>${block(t('econ.routes.route'), r.route) + block(t('econ.routes.over'), r.over) + block(t('econ.routes.seg'), r.seg) + block(t('econ.routes.wave'), r.wave)}</tbody>
    </table></div>
  </div>`;
}

/* Записи, которые заявляют себя расходом и им не являются: форма
   «ДАТА: заход,» есть, а разбор не проходит. Держатся ОТДЕЛЬНО от законных
   нулей `Intent` — там ноль верен по §3, здесь расход был и потерян. */
function malformedHtml(e){
  const list = e.malformed || [];
  if (!list.length) return `<div class="nodata">${t('econ.malformed.none')}</div>`;
  const rows = list.map(m => `<tr>
    <td class="mono dim">${esc(m.cardId.replace(/^card-(\d+).*$/, '$1'))}</td>
    <td>${esc(m.line)}</td>
  </tr>`).join('');
  return `<h3>${t('econ.malformed.title', {n: list.length})}</h3>
    <p class="hint">${t('econ.malformed.hint')}</p>
    <table class="etable">
      <thead><tr><th>${t('econ.th.card')}</th><th>${t('econ.th.line')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* Вес инструктажа — то, что считается из файлов закона и ролей, а не из записи.
   Держится отдельным блоком и подписан «оценка» намеренно: рядом стоят факты,
   снятые с метаданных вызова, и смешивать их с расчётом нельзя — иначе расчёт
   через неделю станет неотличим от измерения. */
function instructionWeightHtml(e, byNode){
  const w = e.instruction;
  if (!w || !w.byNode) return `<div class="nodata">${t('econ.weight.unknown')}</div>`;
  // Строки берутся от ВЕСА, а не от заходов: вес известен у всех пяти узлов,
  // включая тех, кто ещё ни разу не заходил. Строить от заходов значило бы
  // прятать `Core` ровно потому, что его пока не звали.
  const spent = Object.fromEntries((byNode || []).map(n => [n.node, n]));
  const rows = Object.entries(w.byNode).map(([node, v]) => {
    const n = spent[node];
    return `<tr>
      <td>${esc(node)}</td>
      <td class="n">${fmt(v.perStep)}</td>
      <td class="n">${n && n.avgTokens ? fmt(n.avgTokens) : '—'}</td>
      <td class="n">${n && n.avgSteps != null ? n.avgSteps : '—'}</td>
    </tr>`;
  }).join('');
  return `<h3>${t('econ.weight.title')} <span class="hint">— ${t('econ.weight.estimate')}</span></h3>
    <p class="hint">${t('econ.weight.hint', {tokens: fmt(w.common.tokens)})}</p>
    <table class="etable">
      <thead><tr><th>${t('econ.th.node')}</th><th class="n">${t('econ.weight.perStep')}</th><th class="n">${t('econ.weight.perAttempt')}</th><th class="n">${t('econ.weight.steps')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="hint">${t('econ.weight.foot')}</p>`;
}

/* --- Экономика сессий: перечитывание против работы ---------------------------
   Единственное место на вкладке, где величины взяты не из записи в карточке, а из
   стенограмм самого движка. Считает .claude/scripts/session-economy.cjs; здесь только показ. */
function sessionAgeText(se){
  return se.ageHours == null ? '—'
    : se.ageHours < 1 ? t('time.lessThanHour')
    : relTime(se.ageHours * 60);
}

function sessionRowsHtml(se){
  return [...se.sessions].reverse().map(s => `<tr>
    <td class="dim">${(s.first || '—').slice(0, 10)}${s.live ? ` <b title="${esc(t('econ.sess.liveTitle'))}">${t('econ.sess.live')}</b>` : ''}</td>
    <td class="n">${fmt(s.calls)}</td>
    <td class="n">${(s.cacheRead / 1e6).toFixed(1)}</td>
    <td class="n">${fmt(Math.round(s.output / 1e3))}</td>
    <td class="n"><b>${s.ratio ?? '—'}</b></td>
    <td class="n">${s.costUsd != null ? '$' + Math.round(s.costUsd) : '<span class="dim">~$' + Math.round(s.estUsd) + '</span>'}</td>
  </tr>`).join('');
}

// Ход по времени: одно число не отвечает на вопрос «падает или растёт», а он и есть
// главный. Неделя без работы стоит пропуском, а не нулём.
function sessionWeeksHtml(se){
  const weeks = se.byWeek.filter(w => w.ratio != null);
  const wmax = Math.max(...weeks.map(w => w.ratio), 1);
  const bars = weeks.map(w => `<div class="d" style="height:${Math.max(3, pct(w.ratio, wmax))}%"
      title="${t('econ.sw.bar', {week: w.week, ratio: w.ratio, n: w.sessions})}"></div>`).join('');
  const first = weeks[0], last = weeks[weeks.length - 1];
  const trend = (first && last && weeks.length > 1)
    ? t(last.ratio > first.ratio ? 'econ.sw.up' : 'econ.sw.down', {a: first.ratio, wa: first.week, b: last.ratio, wb: last.week})
    : t('econ.sw.few');
  return `<div style="margin-top:14px">
    <p class="hint">${t('econ.sw.lead')} ${trend}</p>
    ${weeks.length ? `<div class="days">${bars}</div>
      <div class="days-ax"><span>${first.week}</span><span>${last.week}</span></div>`
      : `<div class="nodata">${t('econ.sw.none')}</div>`}
  </div>`;
}

function sessionVerifyRowsHtml(v){
  return v.rows.map(r => `<tr>
    <td class="dim">${r.date}</td>
    <td class="n">${r.crPct > 0 ? '+' : ''}${r.crPct}%</td>
    <td class="n">${r.ccPct == null ? '—' : (r.ccPct > 0 ? '+' : '') + r.ccPct + '%'}</td>
    <td class="n">${r.outPct == null ? '—' : (r.outPct > 0 ? '+' : '') + r.outPct + '%'}</td>
    <td class="n">${fmt(r.inheritedCalls || 0)}</td>
    <td>${r.suspect ? `<b>${t('econ.verify.suspect')}</b>` : t('econ.verify.ok')}</td>
  </tr>`).join('');
}

function sessionVerifyHtml(v){
  const vrows = sessionVerifyRowsHtml(v);
  return `<h3>${t('econ.blocks.verify')}</h3>
    <p class="hint">${t('econ.verify.hint', {pct: v.suspectThresholdPct, checked: v.sessionsChecked, total: v.sessionsTotal})}</p>
    ${v.sessionsChecked ? `<table class="etable">
      <thead><tr><th>${t('econ.th.session')}</th><th class="n">${t('econ.verify.reread')}</th><th class="n">${t('econ.verify.cacheNew')}</th>
        <th class="n">${t('econ.verify.out')}</th><th class="n">${t('econ.verify.inherited')}</th><th>${t('econ.verify.result')}</th></tr></thead>
      <tbody>${vrows}</tbody></table>
      <p class="hint" style="margin-top:10px">${t('econ.verify.note')}</p>`
      : `<div class="nodata">${t('econ.verify.none')}</div>`}`;
}

/** Уровень 5, «Таблица сессий»: сводка + таблица + ход по неделям — без самосверки (та отдельным блоком). */
function sessionTableBlockHtml(se){
  if (!se) return `<div class="nodata">${t('econ.sess.none')}</div>`;
  if (se.error) return `<div class="nodata">${esc(se.error)}</div>`;
  const tot = se.totals;
  const liveCount = se.sessions.filter(s => s.live).length;
  return `<p class="hint">
      ${t('econ.sess.hint', {age: sessionAgeText(se)})}
      ${liveCount ? t('econ.sess.liveCount', {n: liveCount}) : ''}
    </p>
    <div class="cov-legend" style="padding:0 10px 10px">
      <span>${t('econ.sess.sessions', {n: tot.sessions})}</span>
      <span>${t('econ.sess.calls', {n: fmt(tot.calls)})}</span>
      <span>${t('econ.sess.reread', {n: fmt(Math.round(tot.cacheRead / 1e6))})}</span>
      <span>${t('econ.sess.produced', {n: fmt(Math.round(tot.output / 1e6))})}</span>
      <span class="dim">${t('econ.sess.money', {exact: tot.costUsdSessions, total: tot.sessions, usd: fmt(Math.round(tot.bestUsd))})}</span>
    </div>
    <table class="etable">
      <thead><tr><th>${t('econ.th.session')}</th><th class="n">${t('econ.sess.thCalls')}</th><th class="n">${t('econ.sess.thReread')}</th>
        <th class="n">${t('econ.sess.thOut')}</th><th class="n">${t('econ.sess.thRatio')}</th><th class="n">${t('econ.sess.thCost')}</th></tr></thead>
      <tbody>${sessionRowsHtml(se)}</tbody>
    </table>
    ${sessionWeeksHtml(se)}`;
}

function codexUsageHtml(dialog){
  const c = dialog && dialog.codex;
  if (!c) return `<div class="nodata">${t('econ.codex.none')}</div>`;
  const row = (label, v) => `<tr><td><b>${label}</b></td><td class="n">${fmt(v.calls)}</td><td class="n">${fmt(v.tokens)}</td><td class="n">${fmt(v.cacheRead)}</td><td class="n">${t('econ.of', {a: v.cacheKnown, b: v.calls})}</td></tr>`;
  const main = c.byKind && c.byKind.main || { calls:0,tokens:0,cacheRead:0,cacheKnown:0 };
  const children = c.byKind && c.byKind.subagent || { calls:0,tokens:0,cacheRead:0,cacheKnown:0 };
  return `<h3>${t('econ.codex.title')}</h3>
    <p class="dim">${t('econ.codex.hint', {n: fmt((c.sessions || []).length)})}</p>
    <table class="etable"><thead><tr><th>${t('econ.codex.thItem')}</th><th class="n">${t('econ.codex.thCalls')}</th><th class="n">${t('econ.th.tokensLc')}</th><th class="n">${t('econ.codex.thCache')}</th><th class="n">${t('econ.codex.thR')}</th></tr></thead><tbody>${row(t('econ.dlg.name'), main)}${row(t('econ.subagents.short'), children)}</tbody></table>`;
}

function notForEngineHtml(_title, owner, cur){
  return `<div class="nodata" data-not-for="${esc(owner)}">${t('econ.notFor', {engine: esc(engineLabel(cur || '—')), owner: esc(owner)})}</div>`;
}

/* --- Уровень 5: справка и аудит, всё свёрнуто по умолчанию -------------------- */
function level5Html(view){
  const e = view.economy;
  const sessionBody = view.econEngine === 'claude-code'
    ? sessionTableBlockHtml(view.sessionEconomy)
    : (view.econEngine === 'codex' ? codexUsageHtml(view.dialog) : notForEngineHtml('sessions', 'claude-code', view.econEngine));
  const verifyBody = view.econEngine === 'claude-code' && view.sessionEconomy && !view.sessionEconomy.error
    ? sessionVerifyHtml(view.sessionEconomy.verification)
    : notForEngineHtml('verify', 'claude-code', view.econEngine);
  const blocks = [
    [t('econ.blindSpots'), blindSpotsHtml(e)],
    [t('econ.blocks.malformed'), malformedHtml(e)],
    [t('econ.blocks.verify'), verifyBody],
    [t('econ.weight.title'), instructionWeightHtml(e, view.byNode)],
    [t('econ.blocks.sessions'), sessionBody],
    [t('econ.blocks.config'), configHtml(view.nodeConfig)],
  ];
  return `<div class="tier"><div class="tier-lab">${t('econ.l5.tier')}</div>
    <div class="erow erow-6">${blocks.map(([ttl, b]) => accDetails(ttl, b, false)).join('')}</div>
  </div>`;
}

/* --- Шапка: тег движка + достоверность данных --------------------------------- */
function trustBadgeHtml(coverage){
  if (!coverage || !coverage.cardsWorked) {
    return `<div class="e-trust"><span class="dim">${t('econ.trust')}</span><b class="mono dim">—</b></div>`;
  }
  const share = pct(coverage.cardsWithAttempts, coverage.cardsWorked);
  return `<div class="e-trust"><span class="dim">${t('econ.trust')}</span>
    <span class="e-meter"><i style="width:${share}%"></i></span>
    <b class="mono">${share}%</b></div>`;
}

/* Экономика по движкам. Токены разных движков в одну
   сумму не идут: всё, где стоят токены, рисуется по выбранному тегу; общая строка —
   только заходы, время и принятые карточки. */
let ECON_ENGINE = null;
const engineLabel = k => k === 'untagged' ? t('econ.untagged') : k;
function engineTableHtml(b, bare){
  const heading = bare ? '' : `<h3>${t('econ.eng.title')}</h3>`;
  if (!b || !b.keys.length) return `${heading}<div class="nodata">${t('econ.eng.none')}</div>`;
  const col = k => b.columns[k];
  // Деталь (cache-read/время/id) — в title, не инлайн: длинный id в видимом тексте
  // ячейки раздувал всю колонку таблицы auto-layout'ом, и короткие числа строк
  // выше (right-aligned) уезжали за видимый край прокрутки.
  const unk = u => {
    const detail = (u.cache_read || u.duration_s || u.call_id)
      ? t('econ.eng.detail', {cr: u.cache_read, time: u.duration_s, id: u.call_id}) : '';
    return `<span${detail ? ` class="dim" title="${esc(detail)}"` : ''}>${t('econ.unknown', {n: u.tokens})}</span>`;
  };
  const row = (label, f, common) => `<tr><td class="elbl">${label}</td>${b.keys.map(k => `<td class="n">${f(col(k))}</td>`).join('')}<td class="n">${common}</td></tr>`;
  const c = b.common;
  const noSum = `<span class="dim">${t('econ.eng.noSum')}</span>`;
  return `${heading}
    ${hintFold(`<p class="hint">${t('econ.eng.hint')}</p>`)}
    <div class="etable-scroll"><table class="etable" style="min-width:${120 + b.keys.length * 100}px">
      <thead><tr><th></th>${b.keys.map(k => `<th class="n">${esc(engineLabel(k))}</th>`).join('')}<th class="n">${t('econ.eng.common')}</th></tr></thead>
      <tbody>
        ${row(t('econ.th.attempts'), v => fmt(v.attempts), fmt(c.attempts))}
        ${row(t('econ.th.time'), v => secText(v.seconds), secText(c.seconds))}
        ${row(t('econ.eng.cardsWithRec'), v => fmt(v.cards), '<span class="dim">—</span>')}
        ${row(t('econ.eng.accepted'), () => '<span class="dim">—</span>', fmt(c.accepted))}
        ${row(t('econ.th.tokens'), v => fmt(v.tokens), noSum)}
        ${row('Cache-read', v => fmt(v.cacheRead), noSum)}
        ${row(t('econ.eng.unknownRow'), v => unk(v.unknown), '<span class="dim">—</span>')}
      </tbody>
    </table></div>`;
}

function renderEconomy(d){
  const e = d.economy || {};
  const engines = e.engines || {};
  const keys = (e.byEngine && e.byEngine.keys || Object.keys(engines)).filter(k => engines[k]);
  if (!keys.includes(ECON_ENGINE)) ECON_ENGINE = keys[0] || null;
  const v = ECON_ENGINE ? engines[ECON_ENGINE] : null;
  const view = v
    ? { ...d, econEngine: ECON_ENGINE, byNode: v.byNode, byRoute: v.byRoute, economy: { ...e, ...v } }
    : { ...d, econEngine: null, byNode: [], byRoute: null };
  const dialog = ECON_ENGINE === 'claude-code' ? d.dialog : null;
  const header = `<div class="e-topbar">
    <div class="e-seg">${keys.map(k =>
      `<span class="${k === ECON_ENGINE ? 'on' : ''}" data-engine="${esc(k)}">${esc(engineLabel(k))}</span>`).join('')}</div>
    <span class="dim">— ${t('econ.engineNote')}</span>
    ${trustBadgeHtml(e.coverage)}
  </div>`;
  const el = document.getElementById('economy');
  el.innerHTML = header
    + level1Html(d, view)
    + level2Html(view)
    + level3Html(view, dialog)
    + level4Html(d, view)
    + level5Html(view);
  el.querySelectorAll('[data-engine]').forEach(x => x.onclick = () => { ECON_ENGINE = x.dataset.engine; renderEconomy(latestData); });
}
