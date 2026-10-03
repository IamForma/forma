// Вкладка «Борт».

/* ===================== БОРТ ==========================================
   Что стоит на борту у каждого узла и у сессии. Три яруса, и они не смешиваются:
   арсенал узла правится файлом роли, MCP-серверы объявлены на всю сессию сразу,
   пол окна — движком, и нам не подчиняется. Кнопок «отключить» нет ни у чего:
   экран называет АДРЕС правки, а правка идёт обычным путём — карточка, `Kit`, сверка.
   ==================================================================== */

const VD = {
  live:    {cls:'vd-live',    label:'в деле'},
  dead:    {cls:'vd-dead',    label:'доказанно лишний'},
  unknown: {cls:'vd-unknown', label:'не знаем'},
};

function vdPill(kind, n){
  return `<span class="vd ${VD[kind].cls}">${VD[kind].label}: ${n}</span>`;
}

function bortNodeHtml(n){
  const head = `<div class="bort-node-head">
    <span class="node-name" style="--node-color:var(--accent)">${esc(n.node)}</span>
    <span class="mono-cell">${esc(n.model || 'модель не указана')}${n.effort ? ' · ' + esc(n.effort) : ''}</span>
    <span class="spacer" style="flex:1"></span>
    ${n.inherits ? '' :
      `<span class="mono-cell">объявлено <b>${n.toolCount}</b> · вес ≈ <b>${fmt(n.weightTokens)}</b> токенов на шаг</span>`}
  </div>`;

  if (n.inherits) {
    return `<div class="bort-node">${head}
      <div class="bort-tools"><span class="node-empty">Поля <code>tools</code> во фронтматтере нет — роль
      наследует весь набор сессии. Вычитать не из чего, и это не «инструментов ноль»: их максимум.</span></div>
      <div class="bort-addr">Адрес правки: <code>.claude/agents/${esc(n.file)}</code>, поле <code>tools</code>.</div>
    </div>`;
  }

  // Порядок: сперва то, что в деле, потом доказанно лишнее, потом неизвестное.
  const order = {live:0, dead:1, unknown:2};
  const tools = [...n.tools].sort((a,b) =>
    order[a.verdict] - order[b.verdict] || b.calls - a.calls || a.decl.localeCompare(b.decl));

  const chips = tools.map(t => `<span class="bort-tool ${t.verdict}" title="${esc(VD[t.verdict].label)}${
      t.ambiguous ? ' — журнал хранит только имя инструмента, без аргументов: какая именно из записей Bash(...) сработала, отсюда не видно' : ''}">
      ${esc(t.decl)}<span class="c">${t.verdict === 'unknown' ? '?' : '×' + t.calls}</span>${t.ambiguous ? '<span class="c">≈</span>' : ''}
    </span>`).join('');

  const counts = `<div class="bort-node-head" style="border-top:1px solid var(--border-soft);border-bottom:none;padding-top:10px">
    ${n.counts.live ? vdPill('live', n.counts.live) : ''}
    ${n.counts.dead ? vdPill('dead', n.counts.dead) : ''}
    ${n.counts.unknown ? vdPill('unknown', n.counts.unknown) : ''}
    <span class="mono-cell">${n.nodeInLog
      ? 'в журнале ' + fmt(n.calls) + ' ' + plural(n.calls, 'попытка', 'попытки', 'попыток')
      : 'по этому узлу в журнале нет ни одной строки — вердикт вынести не на чем'}</span>
    ${n.counts.dead ? `<span class="spacer" style="flex:1"></span><span class="mono-cell">возится зря ≈ <b>${fmt(n.deadWeight)}</b> токенов на шаг</span>` : ''}
  </div>`;

  const undecl = n.undeclared.length
    ? `<div class="bort-addr">Тянулись, но во фронтматтере не объявлено (неявные инструменты движка):
       ${n.undeclared.map(u => `<code>${esc(u.tool)}</code> ×${u.calls}`).join(', ')}.
       В вес и в вердикты не входят — это не наш арсенал, подрезать нечего.</div>`
    : '';

  return `<div class="bort-node">${head}<div class="bort-tools">${chips}</div>${counts}${undecl}
    <div class="bort-addr">Адрес правки: <code>.claude/agents/${esc(n.file)}</code>, поле <code>tools</code>.
    Кнопки «отключить» здесь нет намеренно — правка арсенала идёт карточкой через <code>Kit</code>.</div>
  </div>`;
}

function bortNodesHtml(b, withNodes = true){
  if (!b.source) {
    return `<div class="nodata"><b>Ярус узлов построить не на чем.</b> Модуль
      <code>.claude/scripts/tool-usage.cjs</code> рядом не найден — дашборд и протокол
      ставятся разными шаблонами плагина. Это не «инструментов нет», это нет источника.</div>`;
  }

  let banner = '';
  if (!b.log.alive) {
    banner = `<div class="nodata"><b>Журнала нет вовсе.</b> Файл <code>.forma/dashboard/tool-usage.log</code>
      создаёт сам хук <code>.claude/hooks/tool-usage.sh</code> при первом же вызове — его отсутствие
      значит, что хук не отработал ни разу. Пока журнала нет, вердикт по КАЖДОМУ инструменту —
      <span class="vd vd-unknown">не знаем</span>, и ни один не будет назван лишним.</div>`;
  } else if (!b.log.usable) {
    banner = `<div class="nodata"><b>Журнал заведён, записей нет.</b> Хук жив (заголовок писал он),
      вызовов с его появления не было. Вердикт по всему арсеналу — <span class="vd vd-unknown">не знаем</span>.</div>`;
  } else {
    const missing = b.nodes.filter(n => !n.nodeInLog).map(n => n.node);
    banner = `<div class="cov">
      <h3>Охват журнала: ${b.totals.nodesInLog} ${plural(b.totals.nodesInLog,'узел','узла','узлов')} из ${b.totals.nodeCount}</h3>
      <p>Журнал закрывает наглухо ровно одну сторону: ни одной попытки — инструмент возится зря.
      Обратное неверно дважды. Попытка пишется хуком <i>до</i> решения о доступе, то есть значит
      «тянулся», а не «сработало». И, что важнее для подрезки: <b>отсутствие журнала по узлу не
      означает, что его инструменты лишние</b>.${missing.length ? ` Сегодня журнал ничего не знает про
      <b>${missing.map(esc).join('</b>, <b>')}</b> — их арсеналы помечены «не знаем», а не «лишние».
      Экран, выдавший бы их за мёртвые, предложил бы срезать нужное и выглядел бы при этом убедительно.` : ''}</p>
      <div class="cov-legend">
        ${vdPill('live', b.totals.live)} ${vdPill('dead', b.totals.dead)} ${vdPill('unknown', b.totals.unknown)}
        <span>всего объявлено <b>${b.totals.toolCount}</b>, вес ≈ <b>${fmt(b.totals.weightTokens)}</b> токенов на шаг
        (из них доказанно зря ≈ <b>${fmt(b.totals.deadWeight)}</b>)</span>
      </div>
    </div>`;
  }

  const errs = b.log.errorCount
    ? `<div class="nodata">Хук сломался на <b>${b.log.errorCount}</b> ${plural(b.log.errorCount,'вызове','вызовах','вызовах')}:
       эти попытки в счёт не попали, и «не пользовался» по ним читать нельзя. Разбор —
       <code>node .claude/scripts/tool-usage.cjs</code>.</div>`
    : '';

  return banner + errs + (withNodes ? b.nodes.map(bortNodeHtml).join('') : '');
}

function bortSessionHtml(b){
  const rows = b.servers.filter(s => !s.broken).map(s => `<tr>
    <td class="mono-cell"><b>${esc(s.name)}</b></td>
    <td class="dim">${esc(s.transport)}</td>
    <td class="ttl" title="${esc(s.target)}">${esc(s.target || '—')}</td>
    <td class="dim">${esc(s.level || '—')}</td>
    <td class="mono-cell dim">${esc(s.source)}</td>
  </tr>`).join('');

  const scanned = b.mcpScanned || [];
  const fileCount = b.servers.filter(s => !s.broken).length;
  const scannedLine = scanned.length
    ? scanned.map(s => `<code>${esc(s.source)}</code> — ${s.broken ? 'не разобран' : (s.exists ? `${s.count} серв.` : 'файла нет')}`).join(' · ')
    : '';

  const broken = b.servers.filter(s => s.broken)
    .map(s => `<div class="nodata">Файл <code>${esc(s.source)}</code> не разобран — это поломка конфигурации, не «серверов нет».</div>`).join('');

  const refRows = b.referenced.map(r => `<tr>
    <td class="mono-cell"><b>${esc(r.server)}</b></td>
    <td class="n">${r.toolCount}</td>
    <td class="dim">${r.nodes.map(esc).join(', ')}</td>
    <td>${r.inProjectConfig
      ? '<span class="vd vd-live">объявлен в конфигурации</span>'
      : '<span class="vd vd-unknown">в файлах конфигурации не найден</span>'}</td>
  </tr>`).join('');

  return `${broken}
    <div class="ebox">
      <h3>Объявлено в файлах конфигурации — ${fileCount}</h3>
      <p class="hint">Два уровня: <b>проект</b> (<code>.mcp.json</code>, <code>.claude/.mcp.json</code>) ездит
      с репозиторием, <b>пользователь</b> (<code>~/.claude.json</code>, ключ <code>mcpServers</code>) — с человеком.
      У каждого сервера сказано, откуда он взялся: подрезка здесь действует на весь борт, и править надо
      тот файл, что назван, а не любой.${scannedLine ? ` Просмотрено: ${scannedLine}.` : ''}</p>
      ${rows ? `<table class="etable"><thead><tr><th>Сервер</th><th>Транспорт</th><th>Адрес</th><th>Уровень</th><th>Файл</th></tr></thead><tbody>${rows}</tbody></table>`
             : '<div class="nodata">Ни один из просмотренных файлов конфигурации не объявляет серверов.</div>'}
      <div class="nodata" style="margin-top:12px"><b>Этот список неполон по устройству, а не потому что пусто.</b>
      С диска видно ${fileCount} — столько объявлено файлами. Сверх них сессия несёт <b>коннекторы уровня
      учётной записи</b> (Magnific, Miro, Google Drive, Claude Docs и прочие, подключённые в claude.ai) и
      <b>серверы плагинов</b>: ни тех, ни других нет ни в одном локальном файле, и дашборд прочитать их
      не может. Это не «их нет» — это «отсюда не видно»: смотреть в настройках claude.ai (коннекторы) и
      в <code>claude plugin list</code> (плагины). То же правило, что и вердикт «не знаем» в ярусе узлов:
      отсутствие сведений не выдаётся ни за пусто, ни за полноту.</div>
    </div>
    <div class="ebox">
      <h3>На что ссылаются роли</h3>
      <p class="hint">Имя сервера вынуто из <code>mcp__&lt;сервер&gt;__&lt;инструмент&gt;</code> во фронтматтере.
      «В конфигурации проекта не найден» — <b>не</b> «не авторизован»: сервер может приезжать коннектором
      учётной записи или плагином, а их отсюда не видно. Третье значение и здесь, и по той же причине, что в вердикте выше: экран не
      имеет права называть отсутствие сведений отсутствием сервера.</p>
      ${refRows ? `<table class="etable"><thead><tr><th>Сервер</th><th class="n">Инструментов</th><th>У кого</th><th>Состояние</th></tr></thead><tbody>${refRows}</tbody></table>`
                : '<div class="nodata">Ни одна роль не объявляет MCP-инструментов.</div>'}
    </div>`;
}

/* Линия пола. Рисуется линией, а не числом, намеренно: величина почти целиком —
   собственный промпт движка, и любоваться ею незачем. Читается НАКЛОН. */
function floorChartHtml(f){
  if (!f) {
    return `<div class="nodata"><b>Пол ещё не мерян.</b> Считает <code>node .forma/dashboard/floor.cjs</code> —
      обход стенограмм стоит секунды и гигабайты, поэтому на каждой сборке дашборда он не запускается.
      Это «не мерян», а не «ноль».</div>`;
  }
  if (f.unavailable || !f.byDate || f.byDate.length === 0) {
    return `<div class="nodata"><b>${esc(f.unavailable || 'замеров нет')}.</b>
      На новом проекте это нормальное состояние: первый вызов заведёт первую стенограмму,
      и линия появится сама.</div>`;
  }

  const pts = f.byDate;
  const W = 1000, H = 200, PL = 64, PR = 16, PT = 14, PB = 26;
  const vals = pts.map(p => p.floor);
  // Шкала НЕ от нуля: от нуля линия в 70 тысяч выглядит прямой, и наклон — ровно то,
  // ради чего график заведён, — становится невидим. Поле ±8% сверху и снизу.
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(1, (hi - lo) * 0.25 || hi * 0.02);
  const y0 = lo - pad, y1 = hi + pad;
  const x = i => PL + (pts.length === 1 ? (W-PL-PR)/2 : i * (W - PL - PR) / (pts.length - 1));
  const y = v => PT + (H - PT - PB) * (1 - (v - y0) / (y1 - y0));

  const line = pts.map((p,i) => `${x(i).toFixed(1)},${y(p.floor).toFixed(1)}`).join(' ');
  const dots = pts.map((p,i) => `<circle class="fl-dot" cx="${x(i).toFixed(1)}" cy="${y(p.floor).toFixed(1)}" r="3">
    <title>${esc(p.date)} — ${fmt(p.floor)} токенов${p.sessions > 1 ? ' (нижняя из ' + p.sessions + ' сессий дня)' : ''}</title></circle>`).join('');
  const grid = [y0 + (y1-y0)*0.15, (y0+y1)/2, y1 - (y1-y0)*0.15].map(v =>
    `<line class="fl-grid" x1="${PL}" y1="${y(v).toFixed(1)}" x2="${W-PR}" y2="${y(v).toFixed(1)}"/>
     <text class="fl-lbl" x="${PL-8}" y="${(y(v)+3).toFixed(1)}" text-anchor="end">${fmt(Math.round(v))}</text>`).join('');
  // Подписей дат ровно три — первая, средняя, последняя: на тринадцати точках всё
  // остальное слипается в кашу и мешает видеть линию.
  const ticks = [0, Math.floor((pts.length-1)/2), pts.length-1].filter((v,i,a) => a.indexOf(v) === i)
    .map(i => `<text class="fl-lbl" x="${x(i).toFixed(1)}" y="${H-6}" text-anchor="middle">${esc(pts[i].date)}</text>`).join('');

  const drift = f.drift;
  const driftWord = drift == null ? 'одна точка — наклона ещё нет'
    : (drift > 0 ? 'вырос на ' + fmt(drift) : drift < 0 ? 'опустился на ' + fmt(-drift) : 'не сдвинулся');

  return `<div class="floor-chart">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${grid}<polyline class="fl-line" points="${line}"/>${dots}${ticks}
    </svg>
  </div>
  <div class="cov" style="margin-top:14px">
    <p>Замеров: <b>${pts.length}</b> ${plural(pts.length,'день','дня','дней')} · ниже всего <b>${fmt(f.min)}</b>,
    выше всего <b>${fmt(f.max)}</b> · от первого замера к последнему пол <b>${driftWord}</b>.
    ${f.ageHours != null ? `Ведомость снята ${f.ageHours < 24 ? Math.round(f.ageHours) + ' ч назад' : Math.round(f.ageHours/24) + ' дн назад'}; пересчёт — <code>node .forma/dashboard/floor.cjs</code>.` : ''}</p>
    <p>Читается наклон, а не величина. За два месяца в проект приехали пять ролей, четырнадцать скиллов,
    шестьдесят записей памяти и граф опыта — а пол сдвинулся на несколько тысяч и вернулся обратно.
    Значит он почти целиком <b>не наш</b>, и подрезать в нём нечего: это собственный промпт движка.
    Линия нужна, чтобы поймать день, когда кто-то подключит сервер на двести инструментов, —
    и поймать назавтра, а не через квартал по счёту.</p>
  </div>`;
}

// Узел «Формы» ↔ узел «Борта» по имени без учёта регистра. Борт считается по одному движку (с журналом вызовов).
function bortFind(b, name){
  return b && b.nodes ? b.nodes.find(n => n.node.toLowerCase() === String(name).toLowerCase()) || null : null;
}

// Полоса нагрузки на карточке узла: что объявлено и вердикт одной плашкой.
function bortStripHtml(n, idx){
  let body, cls;
  if (n.inherits) { cls = 'bs-none'; body = `<span class="bs-main">наследует весь набор сессии</span>`; }
  else {
    const main = `<span class="bs-main">${n.toolCount} инстр. · ≈${fmt(n.weightTokens)} ток./шаг</span>`;
    if (!n.nodeInLog) { cls = 'bs-none'; body = `${main}<span class="bs-pill">нет данных журнала</span>`; }
    else if (n.counts.dead) { cls = 'bs-warn'; body = `${main}<span class="bs-pill">лишних: ${n.counts.dead} · ≈${fmt(n.deadWeight)} ток.</span>`; }
    else { cls = 'bs-ok'; body = `${main}<span class="bs-pill">лишнего нет</span>`; }
  }
  return `<button class="bort-strip ${cls}" data-bi="${idx}" title="подробности по инструментам">${body}<span class="bs-go">›</span></button>`;
}

// Сводка под ролями: плитки итогов и по строке-столбцу на узел (в деле / лишнее / не знаем в токенах на шаг).
function bortSummaryHtml(b){
  if (!b || !b.totals) return '';
  const t = b.totals, unit = b.toolTokenCost || 720;
  const rows = b.nodes.filter(n => !n.inherits).sort((a, c) => c.weightTokens - a.weightTokens);
  const max = Math.max(1, ...rows.map(n => n.weightTokens));
  const pct = t.weightTokens ? Math.round(100 * t.deadWeight / t.weightTokens) : 0;
  const tile = (num, lbl, cls = '') => `<div class="bs-tile ${cls}"><b>${num}</b><span>${lbl}</span></div>`;
  const seg = (k, cnt) => cnt ? `<i class="bs-seg ${k}" style="flex:${cnt * unit}" title="${VD[k].label}: ${cnt} × ≈${unit} ток."></i>` : '';
  const bar = n => `<div class="bs-row"><span class="bs-name">${esc(n.node)}</span>
    <span class="bs-track" style="width:${Math.max(8, Math.round(100 * n.weightTokens / max))}%">${seg('live', n.counts.live)}${seg('dead', n.counts.dead)}${seg('unknown', n.counts.unknown)}</span>
    <span class="bs-val">≈${fmt(n.weightTokens)}${n.counts.dead ? ` <u>−${fmt(n.deadWeight)}</u>` : ''}</span></div>`;
  const inh = b.nodes.filter(n => n.inherits).map(n => esc(n.node));
  return `<section class="forma-sec forma-sec--sum"><h2 class="forma-h">Нагрузка по ролям</h2>
    <div class="bs-tiles">
      ${tile(fmt(t.weightTokens), 'токенов на шаг: вес всех арсеналов')}
      ${tile('−' + fmt(t.deadWeight), `можно сэкономить на шаг (${pct}%)`, t.deadWeight ? 'warn' : 'ok')}
      ${tile(t.toolCount, 'инструментов объявлено')}
      ${tile(t.live + ' / ' + t.dead + ' / ' + t.unknown, 'в деле / лишних / не знаем')}
    </div>
    <div class="bs-bars">${rows.map(bar).join('')}</div>
    <div class="bs-legend"><span class="vd vd-live">в деле</span><span class="vd vd-dead">доказанно лишний</span><span class="vd vd-unknown">не знаем</span>
      <span class="dim">длина — вес арсенала узла; «−N» — сколько из него зря${inh.length ? '; без поля tools (наследуют сессию): ' + inh.join(', ') : ''}</span></div>
  </section>`;
}

// Блок «Сессия» вкладки «Форма»: охват журнала (свёрнут), MCP-серверы сессии, пол окна.
function bortSessionBlockHtml(b){
  if (!b) return '';
  return `<section class="forma-sec forma-sec--session"><h2 class="forma-h">Сессия</h2>
    <details class="bs-fold"><summary>Охват журнала вызовов</summary>${bortNodesHtml(b, false)}</details>
    <details class="bs-fold"><summary>MCP-серверы сессии</summary>${bortSessionHtml(b)}</details>
    <details class="bs-fold"><summary>Пол окна — стоимость пустого вызова</summary>
      <p class="hint">Минимальный размер окна среди вызовов сессии: самый дешёвый вызов, в котором лежит один инструктаж и почти ничего сверх.</p>
      ${floorChartHtml(b.floor)}</details>
    <p class="dim">Нагрузка по каждому узлу — полоса на его карточке, подробности по клику. Кнопок «отключить» нет: правка идёт карточкой через <code>Kit</code>.</p>
  </section>`;
}
