// Вкладка «Экономика»: пять уровней от ключевых метрик к справке, по одобренному макету.
// Уровень 1 — пять плиток, уровень 2 — динамика и структура, уровень 3 — где уходят токены,
// уровень 4 — деньги/движки/субагенты (свёрнуто), уровень 5 — справка и аудит (свёрнуто).
// Блоки уровней 3-5 переиспользуют существующие функции разбора без изменения их тел.

function tilesHtml(t, dialog){
  // Три статьи расхода (AGENTS.md §3): узлы по `## История`, диалог Intent ↔ человек
  // по стенограмме основной сессии (работа без кэш-чтения), и их сумма.
  // Токены по узлам и «всего» здесь не стоят: они сложены из разных движков —
  // по движкам см. таблицу выше. Диалог — стенограмма одного движка (claude-code).
  const dlg = dialog && dialog.all ? dialog.all.work : 0;
  const tiles = [
    {num:t.epicCount, lbl:"эпиков"},
    {num:t.cardCount, lbl:"карточек всего"},
    {num:t.attemptCount, lbl:"заходов с записью расхода", pending:t.attemptCount===0},
    ...(dialog ? [{num:dlg, lbl:"токенов в диалоге Intent ↔ человек (claude-code)", pending:!dlg}] : []),
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
    <h2>Статус всех карточек</h2>
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
      ? '<span class="external-yes">да</span>'
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
    <h2>Оснастка узлов по умолчанию</h2>
    <table class="config-table">
      <thead><tr><th>Узел</th><th>Модель</th><th>Усилие</th><th>Инструментов</th><th>Внешняя модель</th></tr></thead>
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
    ? `текущая: <b>${fmt(cur.work)}</b> ток. (${fmt(cur.cacheRead)} кэш-чт.) · ${cur.calls} выз.${cur.sessions > 1 ? ` · живых сессий ${cur.sessions}` : ''}`
    : 'текущая: нет живой сессии';
  const allTxt = all
    ? `всего: <b>${fmt(all.work)}</b> ток. (${fmt(all.cacheRead)} кэш-чт.) · ${all.sessions} сесс. · $${fmt(Math.round(all.usd || 0))}${all.ageHours != null && all.ageHours > 24 ? ` · ведомость ${Math.round(all.ageHours)} ч` : ''}`
    : 'всего: ведомость не собрана (<code>node .claude/scripts/session-economy.cjs</code>)';
  return `<div class="node-row node-row-dialog" style="--node-color:${NODE_COLORS.Intent || '#8891A2'}" title="Диалог в основной сессии — отдельная статья, не в ## История (AGENTS.md §3)">
      <span class="node-name">Intent ↔ человек</span>
      <span class="node-bar-track"><span class="node-bar-fill" style="width:${pct}%"></span></span>
      <span class="node-figures">${curTxt}<br>${allTxt}</span>
    </div>`;
}

function econNodesHtml(byNode, dialog){
  if ((!byNode || !byNode.length) && !(dialog && (dialog.current || dialog.all))) {
    return `<section class="nodes-card">
      <h2>Расход по узлам</h2>
      <div class="node-empty">Нет ни одной записанной строки расхода в историях карточек (формат — <code>AGENTS.md</code> §3).</div>
    </section>`;
  }
  byNode = byNode || [];
  const maxTokens = Math.max(...byNode.map(n => n.tokensTotal), dialog && dialog.all ? dialog.all.work : 0, 1);
  const rows = byNode.map(n => {
    const color = NODE_COLORS[n.node] || "#8891A2";
    const pct = Math.max((n.tokensTotal / maxTokens * 100), n.tokensTotal > 0 ? 1.5 : 0);
    const money = n.costUsdTotal > 0 ? ` · <b>$${n.costUsdTotal.toFixed(4)}</b> (${n.externalAttemptCount} внеш.)` : '';
    return `<div class="node-row" style="--node-color:${color}">
      <span class="node-name">${n.node}</span>
      <span class="node-bar-track"><span class="node-bar-fill" style="width:${pct}%"></span></span>
      <span class="node-figures"><b>${fmt(n.tokensTotal)}</b> ток. · ${n.attemptCount} зах. · ${n.cardCount} карт.${money}</span>
    </div>`;
  }).join('');
  return `<section class="nodes-card">
    <h2>Расход по узлам</h2>
    <div class="node-rows">${rows}${dialogRowHtml(dialog, maxTokens)}</div>
  </section>`;
}

// Компактная панель по образцу трёх панелей Graphify (`graphifyPanelHtml`) — постоянные
// субагенты (живут сквозь много задач, не по одной карточке, `kit.md`-задача «учёт расхода
// постоянных субагентов»). Без точного обратного отсчёта по дням — только мягкое
// предупреждение при простое дольше SUBAGENT_STALE_DAYS-эквивалента (`entry.stale` уже
// посчитан в generate.js, семантика retention не подтверждена документацией однозначно).
function subagentsHtml(list, bare){
  const heading = bare ? '' : '<h2>Постоянные субагенты</h2>';
  if (!list || !list.length) {
    return `<section class="config-card">
      ${heading}
      <div class="node-empty" style="padding:0 18px 16px">Реестр пуст — ни один постоянный субагент ещё не записал расход (<code>.forma/dashboard/.cache/subagents-registry.json</code>, пишет <code>.forma/dashboard/subagents-log.cjs</code>).</div>
    </section>`;
  }
  const rows = list.map(a => {
    const badge = a.stale ? graphifyBadgeHtml(`Давно не трогали (>${'25'} дней) — проверить обращением перед тем как полагаться.`) : '';
    return `<div class="card-row" style="grid-template-columns:8px 1fr auto; align-items:start">
      <span class="status-dot" style="background:${a.stale ? 'var(--st-review)' : 'var(--st-done)'}; margin-top:5px"></span>
      <span>
        <span class="card-title" style="display:block" title="${(a.role||a.agent).replace(/"/g,'&quot;')}"><b class="mono">${a.agent}</b> — ${a.role || '(роль не указана)'}</span>
        ${badge}
      </span>
      <span class="card-tags mono" style="align-self:flex-start">${fmt(a.calls)} выз. · ${fmt(a.tokensTotal)} ток. · нанят ${timeAgo(a.hiredAt)} · был ${timeAgo(a.lastUsedAt)}</span>
    </div>`;
  }).join('');
  return `<section class="config-card">
    ${heading}
    <div class="epic-list" style="margin-top:6px">${rows}</div>
  </section>`;
}

function moneyHtml(totals, byNode, bare){
  const heading = bare ? '<div class="e-sub-lbl">Деньги</div>' : '<h2>Внешний API · расход в деньгах</h2>';
  const externalNodes = (byNode || []).filter(n => n.costUsdTotal > 0);
  if (!totals.costUsdTotal) {
    return `<section class="money">
      <div class="money-head">
        ${heading}
        <span class="status-chip">не подключено</span>
      </div>
      <div class="money-figure">—</div>
      <p>Появляется тем же порядком, что и токены (<code>AGENTS.md</code> §3): узел, вызванный через внешнюю модель напрямую (<code>Bash</code>, не Agent tool), пишет в историю строку с <code>$</code>. Пока таких строк нет — раздел ждёт первой, не удалён и не спрятан.</p>
    </section>`;
  }
  const rows = externalNodes.map(n => `<div class="card-row" style="grid-template-columns:8px 1fr auto">
    <span class="status-dot" style="background:${NODE_COLORS[n.node] || '#8891A2'}"></span>
    <span class="card-title">${n.node}</span>
    <span class="card-tags mono">$${n.costUsdTotal.toFixed(4)} · ${n.externalAttemptCount} вызов(ов)</span>
  </div>`).join('');
  return `<section class="money">
    <div class="money-head">
      ${heading}
      <span class="status-chip" style="color:var(--st-done); border-color:var(--st-done)">подключено</span>
    </div>
    <div class="money-figure">$${totals.costUsdTotal.toFixed(4)}</div>
    <div class="epic-list" style="margin-top:4px">${rows}</div>
    <p>Формат — <code>AGENTS.md</code> §3: <code>$X.XXXXXX (провайдер/модель)</code> в той же строке захода, что и токены. Числа берутся из ответа моста (<code>.claude/scripts/external-model-bridge.cjs</code>), не оцениваются на глаз.</p>
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
  if (diff === 0) return '<span class="dim">без изменений</span>';
  const p = Math.round(Math.abs(diff) / prev * 100);
  // Меньше — лучше: та же карточка обошлась дешевле.
  return `<span class="delta ${diff < 0 ? 'good' : 'bad'}">${diff < 0 ? '▼' : '▲'} ${p}% к предыдущей дате&nbsp;закрытия</span>`;
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
  const t = view.economy.totals || {};
  const cov = d.economy.coverage || {};
  const totalsAll = d.totals;
  const blind = cov.cardsWorked ? Math.max(0, cov.cardsWorked - cov.cardsWithAttempts) : null;
  const blindPct = cov.cardsWorked ? pct(blind, cov.cardsWorked) : null;
  const tiles = [
    { cls: 'hero', lbl: 'Токенов на закрытую карточку',
      num: f.cardsCounted ? fmt(f.perCard) : '—',
      sub: f.cardsCounted
        ? heroDeltaHtml(f.byDate) + sparkHtml(f.byDate)
        : '<div class="lbl">закрытых карточек с записанным расходом пока нет</div>' },
    { cls: '', lbl: 'Всего токенов', num: t.tokens ? fmt(t.tokens) : '—' },
    { cls: '', lbl: 'Стоимость',
      num: totalsAll.costUsdTotal ? '$' + totalsAll.costUsdTotal.toFixed(4) : '—',
      sub: `<div class="lbl">${totalsAll.costUsdTotal ? 'по ответам внешних моделей' : 'внешние вызовы не подключены'}</div>` },
    { cls: '', lbl: 'Принято карточек', num: `${fmt(totalsAll.byStatus.done || 0)} / ${fmt(totalsAll.cardCount)}`,
      sub: `<div class="lbl">заходов: ${fmt(totalsAll.attemptCount)}</div>` },
    { cls: 'alert', lbl: 'Слепые пятна', num: blindPct != null ? blindPct + '%' : '—',
      sub: '<div class="lbl">карточек без записи расхода</div>' },
  ];
  return `<div class="tier"><div class="tier-lab">1 · Ключевые метрики</div>
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
    return '<div class="nodata">Нет заходов с датой — график появится после первой записи.</div>';
  }
  const w = 640, h = 170;
  const gap = (w - 20) / byDate.length;
  const barW = Math.max(6, Math.min(30, gap - 6));
  const maxTok = Math.max(...byDate.map(x => x.tokens), 1);
  const bars = byDate.map((x, i) => {
    const bh = Math.max(2, (x.tokens / maxTok) * (h - 30));
    return `<rect x="${(10 + i * gap).toFixed(1)}" y="${(h - 10 - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="var(--accent)" opacity=".75"><title>${x.date}: ${fmt(x.tokens)} токенов, ${x.attempts} зах.</title></rect>`;
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
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Токены по дням и токены на карточку">
      <g stroke="var(--border)"><line x1="0" y1="20" x2="${w}" y2="20"/><line x1="0" y1="70" x2="${w}" y2="70"/><line x1="0" y1="120" x2="${w}" y2="120"/><line x1="0" y1="160" x2="${w}" y2="160"/></g>
      <g>${bars}</g>${line}
    </svg>
    <p class="hint">Столбцы: токены за день (${byDate.length} ${plural(byDate.length,'день','дня','дней')}).
      ${known.length > 1 ? 'Линия: токенов на закрытую карточку по дате закрытия, цель — вниз.' : 'Линия не построена: закрытых карточек на эти даты пока нет.'}</p>`;
}

function weeksTrendText(se){
  const weeks = (se.byWeek || []).filter(w => w.ratio != null);
  if (weeks.length < 2) return 'недель с работой пока меньше двух — ход ещё не виден.';
  const first = weeks[0], last = weeks[weeks.length - 1];
  return last.ratio > first.ratio
    ? `растёт: с ${first.ratio} (${first.week}) до ${last.ratio} (${last.week}) — перечитываний на токен работы становится больше.`
    : `падает: с ${first.ratio} (${first.week}) до ${last.ratio} (${last.week}).`;
}

function level2Html(view){
  const e = view.economy, t = e.totals || {}, c = e.coverage || {};
  const trendCard = `<div class="e-card">
    <h3>Тренд по дням</h3>
    ${trendChartHtml(e.byDate, (e.efficiency || {}).byDate)}
  </div>`;
  const stack = c.attemptsWithCacheRead
    ? (() => {
        const inst = pct(t.cacheRead, t.cacheRead + t.work);
        const work = 100 - inst;
        // Подпись внутри узкого сегмента обрезалась бы контейнером (overflow:hidden
        // на `.stack`) — поэтому полные подписи стоят легендой под полосой, а не в ней.
        return `<div class="stack">
            <span style="width:${inst}%;background:var(--st-review)" title="Инструктаж ${inst}%"></span>
            <span style="width:${work}%;background:var(--st-done)" title="Работа ${work}%"></span>
          </div>
          <div class="legend stack-legend">
            <span><span class="dot" style="background:var(--st-review)"></span>Инструктаж <b>${inst}%</b></span>
            <span><span class="dot" style="background:var(--st-done)"></span>Работа <b>${work}%</b></span>
          </div>`;
      })()
    : '<div class="nodata">Доля инструктажа не измерялась — кэш-чтение не записано ни в одном заходе.</div>';
  const seOk = view.econEngine === 'claude-code' && view.sessionEconomy && !view.sessionEconomy.error;
  const ratioCard = seOk
    ? `<div class="kpi-inline"><div class="lbl">Перечитываний на токен работы</div><div class="num mono">${view.sessionEconomy.totals.ratio}</div><p class="hint">${weeksTrendText(view.sessionEconomy)}</p></div>`
    : `<div class="kpi-inline"><div class="lbl">Перечитываний на токен работы</div><div class="num mono dim">—</div><p class="hint">${view.econEngine === 'claude-code' ? 'ведомость сессий не собрана (<code>node .claude/scripts/session-economy.cjs</code>)' : 'считается только для claude-code — выберите тег выше'}</p></div>`;
  const workCard = `<div class="e-card">
    <h3>Инструктаж и работа</h3>
    ${stack}
    ${ratioCard}
  </div>`;
  return `<div class="tier"><div class="tier-lab">2 · Динамика и структура</div>
    <div class="erow erow-2">${trendCard}${workCard}</div>
  </div>`;
}

/* --- Уровень 3: где уходят токены --------------------------------------------
   Переиспользует nodesHtml (переименована в econNodesHtml — коллизия имени с global
   function nodesHtml в nodes.js, тот же глобальный scope, грузится позже и перетирал её)/
   topCardsHtml/routesHtml без изменений — только сетка. */
function level3Html(view, dialog){
  return `<div class="tier"><div class="tier-lab">3 · Где уходят токены</div>
    <div class="erow erow-3">
      ${econNodesHtml(view.byNode, dialog)}
      ${topCardsHtml(view.economy.topCards) || '<div class="e-card"><h3>Дороже всего обошлось</h3><div class="nodata">Нет карточек с записанными токенами.</div></div>'}
      ${routesHtml(view.byRoute) || '<div class="e-card"><h3>По маршрутам</h3><div class="nodata">Разрез по маршрутам не собран.</div></div>'}
    </div>
  </div>`;
}

/* --- Уровень 4: деньги, движки, постоянные субагенты — свёрнуто по умолчанию открыто -- */
function accDetails(title, body, open){
  return `<details class="e-acc"${open ? ' open' : ''}><summary>${esc(title)}</summary><div class="e-acc-body">${body}</div></details>`;
}

function level4Html(d, view){
  const blocks = [
    ['Внешние сервисы и деньги', servicesHtml(view.economy, true) + moneyHtml(d.totals, d.byNode, true)],
    ['Сравнение движков', engineTableHtml(d.economy.byEngine, true)],
    ['Постоянные субагенты', subagentsHtml(d.subagents, true)],
  ];
  return `<div class="tier"><div class="tier-lab">4 · Деньги, движки, постоянные затраты</div>
    <div class="erow erow-3">${blocks.map(([t, b]) => accDetails(t, b, true)).join('')}</div>
  </div>`;
}

/* --- Экономика: тело переиспользуемых блоков уровней 3 и 5 ------------------- */

function economyNodesHtml(byNode){
  const rows = byNode.filter(n => n.attemptCount).map(n => `<tr>
    <td><b>${n.node}</b></td>
    <td class="n">${n.attemptCount}</td>
    <td class="n">${fmt(n.tokensTotal)}</td>
    <td class="n">${n.avgTokens ? fmt(n.avgTokens) : '—'}</td>
    <td class="n">${n.withSeconds ? (n.secondsTotal < 60 ? n.secondsTotal + ' с' : hhmm(n.secondsTotal)) : '—'}${n.withSeconds && n.withSeconds < n.attemptCount ? ` <span class="dim">(у ${n.withSeconds} из ${n.attemptCount})</span>` : ''}</td>
    <td class="n">${n.avgSeconds ? n.avgSeconds + ' с' : '—'}</td>
    <td class="n">${n.cardCount}</td>
  </tr>`).join('');
  return `<div class="ebox">
    <h3>Расход по узлам</h3>
    <p class="hint">Среднее считается по заходам, где поле записано, а не по всем — иначе неполнота
       записи выглядела бы как дешевизна узла.</p>
    <table class="etable">
      <thead><tr><th>Узел</th><th class="n">Заходов</th><th class="n">Токенов</th><th class="n">Ср. заход</th>
        <th class="n">Время</th><th class="n">Ср. время</th><th class="n">Карточек</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="dim">Пока ни одного захода с записью.</td></tr>'}</tbody>
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
    <h3>Дороже всего обошлось</h3>
    ${hintFold('<p class="hint">Здесь искать, что оптимизировать: много заходов на одну карточку — обычно признак того, что нарезка была крупной, а не того, что узел плохо работал.</p>')}
    <div class="etable-scroll"><table class="etable" style="min-width:480px">
      <thead><tr><th>Карточка</th><th class="n">Токенов</th><th></th><th class="n">Заходов</th>
        <th class="n">Время</th><th>Узлы</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function blindSpotsHtml(e){
  const b = e.blindSpots, c = e.coverage;
  if (!c.blindSpotCount) return '<div class="nodata">Слепых пятен нет: у всех карточек, где шла работа, есть запись расхода.</div>';
  const rows = b.map(x => `<tr>
    <td class="ttl" title="${esc(x.title)}">${esc(x.title)}</td>
    <td><span class="pill">${esc(x.status)}</span></td>
    <td class="dim">${esc(x.epic || '—')}</td>
  </tr>`).join('');
  return `<h3>Слепые пятна — ${c.blindSpotCount} ${plural(c.blindSpotCount,'карточка','карточки','карточек')}</h3>
    <p class="hint">Работа шла, расход не записан. Это и есть разрыв между «сделано» и «посчитано»:
       пока он такой, любое сравнение узлов между собой — догадка.
       ${b.length < c.blindSpotCount ? `Показаны первые ${b.length}.` : ''}</p>
    <table class="etable">
      <thead><tr><th>Карточка</th><th>Статус</th><th>Эпик</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function daysHtml(byDate){
  if (!byDate.length) return '';
  const max = Math.max(...byDate.map(d => d.tokens)) || 1;
  const bars = byDate.map(d =>
    `<div class="d" style="height:${Math.max(3, pct(d.tokens, max))}%"
      title="${d.date}: ${fmt(d.tokens)} токенов, ${d.attempts} заходов, ${hhmm(d.seconds)}"></div>`).join('');
  return `<div class="ebox">
    <h3>По дням</h3>
    <p class="hint">Высота — токены за день. Наведите, чтобы увидеть числа.</p>
    <div class="days">${bars}</div>
    <div class="days-ax"><span>${byDate[0].date}</span><span>${byDate[byDate.length - 1].date}</span></div>
  </div>`;
}

/* Внешние сервисы — третий род расхода, рядом с токенами и деньгами.
   Каждый считает в своей единице, поэтому в одну сумму они не сводятся и не должны:
   «1740 кредитов и 12 минут» — это два разных факта, а не одно число. */
function servicesHtml(e, bare){
  const heading = bare ? '<div class="e-sub-lbl">Сервисы</div>' : '<h3>Внешние сервисы</h3>';
  const list = e.byService || [];
  if (!list.length) {
    return `${heading}
      <div class="nodata">
        <b>Ни одного вызова пока не записано.</b>
        Сервис — это Magnific, Aura и подобные: они берут плату <b>в своей единице</b>
        (кредиты, минуты), не в токенах и не в долларах, и потому считаются отдельно.
        Запись: сегмент <code>N единица (сервис/операция)</code> в строке захода,
        число — из ответа самого вызова, не из прайс-листа.
        Какие сервисы подключены и где читается их число — <code>PROJECT.md</code>, «Внешние сервисы».
      </div>`;
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
        <span class="dim">${s.calls} ${plural(s.calls,'вызов','вызова','вызовов')} · ${s.cardCount} ${plural(s.cardCount,'карточка','карточки','карточек')} · ${s.firstDate}${s.lastDate !== s.firstDate ? ' — ' + s.lastDate : ''}</span>
      </div>
      <table class="etable"><tbody>${rows}</tbody></table>
    </div>`;
  }).join('');
  return `${heading}
    ${hintFold('<p class="hint">Единицы у сервисов разные и в одну сумму не сводятся — это разные факты. Внутри сервиса разложено по операциям: цена одной и той же работы меняется с режимом (у Magnific <code>tripo-image-to-3d</code> стоит 580 кредитов, <code>-high</code> — 1160).</p>')}
    ${blocks}`;
}

// Расход по маршрутам: тот же счёт, что `tally.cjs --routes`.
function routesHtml(r){
  if (!r) return '';
  const unk = x => [x.tokensUnknown && `токены: ${x.tokensUnknown}`, x.cacheUnknown && `cache-read: ${x.cacheUnknown}`,
    x.secondsUnknown && `сек: ${x.secondsUnknown}`].filter(Boolean).join(', ');
  // Компактно первыми: метка, карточек, токенов, возвратов — остальные колонки
  // (заходов, cache-read, время, подготовка, unknown) доступны прокруткой вправо.
  const rows = list => list.map(x => `<tr>
    <td><b>${x.key}</b></td>
    <td class="n">${x.cards}</td>
    <td class="n">${fmt(x.tokens)}</td>
    <td class="n">${x.returns}</td>
    <td class="n">${x.attempts}</td>
    <td class="n">${fmt(x.cacheRead)}</td>
    <td class="n">${x.seconds < 60 ? x.seconds + ' с' : hhmm(x.seconds)}</td>
    <td class="n">${x.prepShare == null ? '<span class="dim">не записано</span>' : x.prepShare + '% <span class="dim">(' + x.prepNodes + ')</span>'}</td>
    <td class="dim">${unk(x) || '—'}</td>
  </tr>`).join('');
  const block = (title, list) => list && list.length ? `<tr><th colspan="9">${title}</th></tr>` + rows(list) : '';
  return `<div class="e-card">
    <h3>По маршрутам</h3>
    ${hintFold('<p class="hint">Метки route-N, over-N, seg-N, wave-N. Подготовка — доля Spec + Kit в токенах маршрута; на route-4 Kit — исполнитель, подготовка — только Spec. Возвраты — заходы исполнителя сверх первого. Строки с маркером unknown — отдельной колонкой, не нулём.</p>')}
    <div class="etable-scroll"><table class="etable" style="min-width:640px">
      <thead><tr><th>Метка</th><th class="n">Карточек</th><th class="n">Токенов</th><th class="n">Возвратов</th>
        <th class="n">Заходов</th><th class="n">Cache-read</th><th class="n">Время</th><th class="n">Подготовка</th><th>Unknown</th></tr></thead>
      <tbody>${block('Маршруты', r.route) + block('Надстройки', r.over) + block('Сегменты', r.seg) + block('Волны', r.wave)}</tbody>
    </table></div>
  </div>`;
}

/* Записи, которые заявляют себя расходом и им не являются: форма
   «ДАТА: заход,» есть, а разбор не проходит. Держатся ОТДЕЛЬНО от законных
   нулей `Intent` — там ноль верен по §3, здесь расход был и потерян. */
function malformedHtml(e){
  const list = e.malformed || [];
  if (!list.length) return '<div class="nodata">Все строки, заявившие себя заходом, прошли разбор.</div>';
  const rows = list.map(m => `<tr>
    <td class="mono dim">${esc(m.cardId.replace(/^card-(\d+).*$/, '$1'))}</td>
    <td>${esc(m.line)}</td>
  </tr>`).join('');
  return `<h3>Записи расхода, не прошедшие разбор — ${list.length}</h3>
    <p class="hint">
      В строке стоит <code>ДАТА: заход,</code> — она заявляет себя записью расхода,
      но под формат §3 не подходит и в счёт не попадает.
      <b>Это не то же самое, что законный ноль у <code>Intent</code></b>: там расхода нет по закону,
      здесь он был и потерян. Чаще всего дело не в числах, а в подписи узла —
      формат ждёт <code>&#96;Узел&#96;,</code> в самом начале, а строка начинается с пояснения
      («<code>&#96;Kit&#96;-роль экстракции (субагент 1/4)</code>»), и число за ним уже не читается.
    </p>
    <table class="etable">
      <thead><tr><th>Карточка</th><th>Строка</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* Вес инструктажа — то, что считается из файлов закона и ролей, а не из записи.
   Держится отдельным блоком и подписан «оценка» намеренно: рядом стоят факты,
   снятые с метаданных вызова, и смешивать их с расчётом нельзя — иначе расчёт
   через неделю станет неотличим от измерения. */
function instructionWeightHtml(e, byNode){
  const w = e.instruction;
  if (!w || !w.byNode) return '<div class="nodata">Вес инструктажа неизвестен — нет адаптера движка или он не объявил поле.</div>';
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
  return `<h3>Вес инструктажа <span class="hint">— оценка, не измерение</span></h3>
    <p class="hint">
      Закон входит в вызов <b>не один раз за заход, а заново на каждом внутреннем шаге</b>.
      Поэтому сократить текст закона — выигрыш линейный, а сократить число шагов — множительный.
      Общая часть, одинаковая для всех узлов: <code>AGENTS.md</code> + <code>.claude/rules/claude-8.md</code>
      — ${fmt(w.common.tokens)} токенов; остальное добавляет файл роли.
    </p>
    <table class="etable">
      <thead><tr><th>Узел</th><th class="n">Закон и роль, на шаг</th><th class="n">Всего на заход</th><th class="n">Шагов</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="hint">
      Шаги = кэш-чтение ÷ вес шага, поэтому столбец пуст, пока <code>R</code> не записывают.
      Счёт токенов здесь — по эвристике «байт на токен», токенизатора тут нет.
      Системный промпт движка и описания инструментов в вес не входят — их пишем не мы,
      значит настоящий вес шага <b>больше</b> показанного, а шагов выйдет <b>меньше</b>.
    </p>`;
}

/* --- Экономика сессий: перечитывание против работы ---------------------------
   Единственное место на вкладке, где величины взяты не из записи в карточке, а из
   стенограмм самого движка. Считает .claude/scripts/session-economy.cjs; здесь только показ. */
function sessionAgeText(se){
  return se.ageHours == null ? '—'
    : se.ageHours < 1 ? 'меньше часа назад'
    : se.ageHours < 24 ? `${Math.round(se.ageHours)} ч назад`
    : `${Math.round(se.ageHours / 24)} ${plural(Math.round(se.ageHours / 24),'день','дня','дней')} назад`;
}

function sessionRowsHtml(se){
  return [...se.sessions].reverse().map(s => `<tr>
    <td class="dim">${(s.first || '—').slice(0, 10)}${s.live ? ' <b title="Файл ещё пишется">живая</b>' : ''}</td>
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
      title="${w.week}: ${w.ratio} токенов перечитывания на токен выхода, сессий ${w.sessions}"></div>`).join('');
  const first = weeks[0], last = weeks[weeks.length - 1];
  const trend = (first && last && weeks.length > 1)
    ? (last.ratio > first.ratio
        ? `Растёт: с <b>${first.ratio}</b> (${first.week}) до <b>${last.ratio}</b> (${last.week}) — перечитывания на токен работы становится больше, а не меньше.`
        : `Падает: с <b>${first.ratio}</b> (${first.week}) до <b>${last.ratio}</b> (${last.week}).`)
    : 'Недель с работой пока меньше двух — хода ещё не видно.';
  return `<div style="margin-top:14px">
    <p class="hint">Ход по неделям (перечитываний на токен работы). ${trend}</p>
    ${weeks.length ? `<div class="days">${bars}</div>
      <div class="days-ax"><span>${first.week}</span><span>${last.week}</span></div>`
      : '<div class="nodata">Недель с работой пока нет.</div>'}
  </div>`;
}

function sessionVerifyRowsHtml(v){
  return v.rows.map(r => `<tr>
    <td class="dim">${r.date}</td>
    <td class="n">${r.crPct > 0 ? '+' : ''}${r.crPct}%</td>
    <td class="n">${r.ccPct == null ? '—' : (r.ccPct > 0 ? '+' : '') + r.ccPct + '%'}</td>
    <td class="n">${r.outPct == null ? '—' : (r.outPct > 0 ? '+' : '') + r.outPct + '%'}</td>
    <td class="n">${fmt(r.inheritedCalls || 0)}</td>
    <td>${r.suspect ? '<b>подозрительно</b>' : 'сходится'}</td>
  </tr>`).join('');
}

function sessionVerifyHtml(v){
  const vrows = sessionVerifyRowsHtml(v);
  return `<h3>Самосверка метода</h3>
    <p class="hint">
      Счёт держится на дедупликации по <code>requestId</code>: без неё сумма завышается
      вдесятеро, и по правдоподобию числа этого не видно. Поэтому метод сверяется с чужой
      бухгалтерией — записью <code>cost-state</code>, которую ведёт сам движок, — и
      расхождение печатается <b>всегда</b>, а не только когда сошлось. Больше
      ${v.suspectThresholdPct}% помечается как подозрительное.
      Сверить удаётся <b>${v.sessionsChecked}</b> из <b>${v.sessionsTotal}</b> сессий: в
      остальных такой записи нет, и это тоже показано, а не сглажено.
    </p>
    ${v.sessionsChecked ? `<table class="etable">
      <thead><tr><th>Сессия</th><th class="n">перечит.</th><th class="n">создание кэша</th>
        <th class="n">выход</th><th class="n">унаследовано вызовов</th><th>итог</th></tr></thead>
      <tbody>${vrows}</tbody></table>
      <p class="hint" style="margin-top:10px">«Унаследовано» — вызовы старше точки отсчёта движка: продолжение сессии
        после сжатия копирует прежнюю историю вместе с её <code>requestId</code>. Из сверки они
        исключены, иначе метод обвинял бы движок в недосчёте там, где расходятся границы отсчёта.</p>`
      : '<div class="nodata">Ни в одной сессии нет записи <code>cost-state</code> — сверить метод не с чем. <b>Числа выше остаются непроверенными.</b></div>'}`;
}

/** Уровень 5, «Таблица сессий»: сводка + таблица + ход по неделям — без самосверки (та отдельным блоком). */
function sessionTableBlockHtml(se){
  if (!se) return `<div class="nodata">Ведомость не собрана. Она считается отдельно, потому что обход стенограмм
      стоит секунды и гигабайты: <code>node .claude/scripts/session-economy.cjs</code>, затем
      пересобрать дашборд. <b>Это не ноль, а отсутствие замера.</b></div>`;
  if (se.error) return `<div class="nodata">${esc(se.error)}</div>`;
  const t = se.totals;
  const liveCount = se.sessions.filter(s => s.live).length;
  return `<p class="hint">
      Считано по стенограммам движка — там записан каждый вызов, а не только тот, о котором
      узел не забыл сделать запись. Ведомость собрана ${sessionAgeText(se)}.
      ${liveCount ? `<b>Живых сессий: ${liveCount}</b> — их числа неполны по определению.` : ''}
    </p>
    <div class="cov-legend" style="padding:0 10px 10px">
      <span>сессий: <b>${t.sessions}</b></span>
      <span>вызовов: <b>${fmt(t.calls)}</b></span>
      <span>перечитано: <b>${fmt(Math.round(t.cacheRead / 1e6))}</b> млн токенов</span>
      <span>произведено: <b>${fmt(Math.round(t.output / 1e6))}</b> млн</span>
      <span class="dim">деньги точны у ${t.costUsdSessions} из ${t.sessions} сессий, остальные — оценка по тарифу; вместе ≈ $${fmt(Math.round(t.bestUsd))}</span>
    </div>
    <table class="etable">
      <thead><tr><th>Сессия</th><th class="n">вызовов</th><th class="n">перечит., млн</th>
        <th class="n">выход, тыс</th><th class="n">R/работа</th><th class="n">стоимость</th></tr></thead>
      <tbody>${sessionRowsHtml(se)}</tbody>
    </table>
    ${sessionWeeksHtml(se)}`;
}

function codexUsageHtml(dialog){
  const c = dialog && dialog.codex;
  if (!c) return `<div class="nodata">Измеренная ведомость Codex ещё не собрана.</div>`;
  const row = (label, v) => `<tr><td><b>${label}</b></td><td class="n">${fmt(v.calls)}</td><td class="n">${fmt(v.tokens)}</td><td class="n">${fmt(v.cacheRead)}</td><td class="n">${v.cacheKnown} из ${v.calls}</td></tr>`;
  const main = c.byKind && c.byKind.main || { calls:0,tokens:0,cacheRead:0,cacheKnown:0 };
  const children = c.byKind && c.byKind.subagent || { calls:0,tokens:0,cacheRead:0,cacheKnown:0 };
  return `<h3>Codex: измеренный расход</h3>
    <p class="dim"><code>Intent ↔ человек</code> считается отдельно от карточек; субагенты попадают в карточку только после явной привязки по id. Стенограммы: ${fmt((c.sessions || []).length)}.</p>
    <table class="etable"><thead><tr><th>Статья</th><th class="n">сеансов</th><th class="n">токены</th><th class="n">кэш-чтение</th><th class="n">R записан</th></tr></thead><tbody>${row('Intent ↔ человек', main)}${row('Субагенты', children)}</tbody></table>`;
}

function notForEngineHtml(_title, owner, cur){
  return `<div class="nodata" data-not-for="${esc(owner)}">Не относится к «${esc(engineLabel(cur || '—'))}»: это стенограммы движка <b>${esc(owner)}</b> — выберите его тег выше.</div>`;
}

/* --- Уровень 5: справка и аудит, всё свёрнуто по умолчанию -------------------- */
function level5Html(view){
  const e = view.economy;
  const sessionBody = view.econEngine === 'claude-code'
    ? sessionTableBlockHtml(view.sessionEconomy)
    : (view.econEngine === 'codex' ? codexUsageHtml(view.dialog) : notForEngineHtml('Таблица сессий', 'claude-code', view.econEngine));
  const verifyBody = view.econEngine === 'claude-code' && view.sessionEconomy && !view.sessionEconomy.error
    ? sessionVerifyHtml(view.sessionEconomy.verification)
    : notForEngineHtml('Самосверка метода', 'claude-code', view.econEngine);
  const blocks = [
    ['Слепые пятна', blindSpotsHtml(e)],
    ['Не прошли разбор', malformedHtml(e)],
    ['Самосверка метода', verifyBody],
    ['Вес инструктажа', instructionWeightHtml(e, view.byNode)],
    ['Таблица сессий', sessionBody],
    ['Оснастка узлов', configHtml(view.nodeConfig)],
  ];
  return `<div class="tier"><div class="tier-lab">5 · Справка и аудит</div>
    <div class="erow erow-6">${blocks.map(([t, b]) => accDetails(t, b, false)).join('')}</div>
  </div>`;
}

/* --- Шапка: тег движка + достоверность данных --------------------------------- */
function trustBadgeHtml(coverage){
  if (!coverage || !coverage.cardsWorked) {
    return `<div class="e-trust"><span class="dim">Достоверность данных</span><b class="mono dim">—</b></div>`;
  }
  const share = pct(coverage.cardsWithAttempts, coverage.cardsWorked);
  return `<div class="e-trust"><span class="dim">Достоверность данных</span>
    <span class="e-meter"><i style="width:${share}%"></i></span>
    <b class="mono">${share}%</b></div>`;
}

/* Экономика по движкам. Токены разных движков в одну
   сумму не идут: всё, где стоят токены, рисуется по выбранному тегу; общая строка —
   только заходы, время и принятые карточки. */
let ECON_ENGINE = null;
const engineLabel = k => k === 'untagged' ? 'без тега' : k;
function engineTableHtml(b, bare){
  const heading = bare ? '' : '<h3>Экономика по движкам</h3>';
  if (!b || !b.keys.length) return `${heading}<div class="nodata">Разрез не собран.</div>`;
  const col = k => b.columns[k];
  // Деталь (cache-read/время/id) — в title, не инлайн: длинный id в видимом тексте
  // ячейки раздувал всю колонку таблицы auto-layout'ом, и короткие числа строк
  // выше (right-aligned) уезжали за видимый край прокрутки.
  const unk = u => {
    const detail = (u.cache_read || u.duration_s || u.call_id)
      ? `cache-read ${u.cache_read} · время ${u.duration_s} · id ${u.call_id}` : '';
    return `<span${detail ? ` class="dim" title="${esc(detail)}"` : ''}>неизвестно: ${u.tokens}</span>`;
  };
  const row = (label, f, common) => `<tr><td class="elbl">${label}</td>${b.keys.map(k => `<td class="n">${f(col(k))}</td>`).join('')}<td class="n">${common}</td></tr>`;
  const sec = s => s < 60 ? s + ' с' : hhmm(s);
  const c = b.common;
  return `${heading}
    ${hintFold('<p class="hint">Колонка на каждый тег движка из строк расхода; строки без тега — своей колонкой «без тега». Токены разных движков не складываются — в колонке «общее» только общие поля. «Неизвестно» — строки с маркером <code>unknown</code>, числом, не нулём.</p>')}
    <div class="etable-scroll"><table class="etable" style="min-width:${120 + b.keys.length * 100}px">
      <thead><tr><th></th>${b.keys.map(k => `<th class="n">${esc(engineLabel(k))}</th>`).join('')}<th class="n">общее</th></tr></thead>
      <tbody>
        ${row('Заходов', v => fmt(v.attempts), fmt(c.attempts))}
        ${row('Время', v => sec(v.seconds), sec(c.seconds))}
        ${row('Карточек с записью', v => fmt(v.cards), '<span class="dim">—</span>')}
        ${row('Принято карточек (done)', () => '<span class="dim">—</span>', fmt(c.accepted))}
        ${row('Токенов', v => fmt(v.tokens), '<span class="dim">не складывается</span>')}
        ${row('Cache-read', v => fmt(v.cacheRead), '<span class="dim">не складывается</span>')}
        ${row('Строки с unknown (токены)', v => unk(v.unknown), '<span class="dim">—</span>')}
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
    <span class="dim">— всё, где стоят токены, показано по этому тегу.</span>
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
