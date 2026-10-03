// Вкладка «Закон» и переключатель вкладок. Зовётся из boardInit (board.js) и получает то, что живёт в его области:
// DATA, esc, T (подписи), lbl (подпись метки), ROUTES (карта маршрутов). Возвращает linkLaw — ссылки «§N» в окнах доски.
// Состояние вызова — объект L ({ DATA, esc, T, lbl, ROUTES, tab }); каждый вызов lawInit начинает с вкладки «Закон §1–7».

// --- Вкладка «Закон»: AGENTS.md и всё, чем он управляет (данные — DATA.law, собирает build-board-demo.cjs) ---
const LAW_SEC = { 1: 'Пять пар', 2: 'Маршрут', 3: 'Пороги', 4: 'Маркер позиции', 5: 'Запреты', 6: 'Карточка и проверка формы', 7: 'Доска' };
const PROHIB_RU = ['Работу подтверждает только принимающий узел, не исполнитель', 'Пробел называется точно: адрес и ожидаемое значение', 'Бюджет меняется только через стоп с отчётом', 'Каждый узел сам останавливается на своём пороге', 'Провалы остаются в JOURNAL.md как есть', 'Пример — лишь форма; требования задают критерий и спецификация', 'Исполнитель получает чистую карточку, без истории своих провалов', 'GOAL.md не меняется, пока человек не подтвердил цель', 'Кэш круга несёт только неизменное', 'Возврат задачи меняет хотя бы одну из шести единиц снаряжения', 'Указание человека вне маршрута записывается как изменение', 'Чужой дефект уходит назад по маршруту, не чинится на месте', 'Расхождение называется адресом и ожидаемым значением', 'Второй одинаковый диагноз подряд — стоп', 'Доступы — только в VARS/credentials.md или .env, в карточке — по имени'];
const CHECK_RU = { 'route-labels': 'метки маршрута и одобрение route-0…5', 'route-stage': 'причина (why) и этап (stage) маршрута', 'attempt-format': 'строка захода: cache-read и время', 'agent-id': 'id вызова в строке захода', 'engine-tag': 'движок в начале описания', 'goal-label': 'одна метка цели на карточке', 'spend-english': 'ключевая часть строки расхода по-английски' };
const ROLE_RU = { intent: 'Intent — образ, критерий прихода, проверка задачи; голос перед человеком', spec: 'Spec — нарезка на задачи, одна квалификация на карточку', kit: 'Kit — шесть единиц снаряжения, единый канал возврата', run: 'Run — делает ровно назначенное, с данными скиллами', core: 'Core — пороги, вердикт круга, диагноз узла, тренд', extractor: 'Extractor — извлечение текста, без решений о маршруте' };
const LAW_NAV = [['law', 'Закон §1–7'], ['engine', 'Движок §8'], ['routes', 'Маршруты'], ['roles', 'Роли'], ['ondemand', 'Режимы по запросу'], ['checks', 'Проверки'], ['project', 'Проект'], ['.forma/manual', 'Руководство']];

function lawMd(L, t) { // marked с CDN; без сети — простой показ
  t = String(t || '').replace(/\r/g, '');
  if (window.marked) return marked.parse(t);
  return '<pre class="raw">' + L.esc(t) + '</pre>';
}
function lawSplitSections(t) { // AGENTS.md → вступление + §1…§7
  const parts = t.replace(/\r/g, '').split(/^## (?=\d+\. )/m);
  return { intro: parts[0], secs: parts.slice(1).map(p => { const n = +p.match(/^(\d+)/)[1]; const nl = p.indexOf('\n'); return { n, title: p.slice(0, nl).replace(/^\d+\.\s*/, ''), body: p.slice(nl + 1) }; }) };
}
function lawBodyLaw(L, anchor) {
  const { esc } = L, md = t => lawMd(L, t);
  const { intro, secs } = lawSplitSections(L.DATA.law.agents);
  return `<div class="lawgrid"><aside class="toc"><b>AGENTS.md</b>${secs.map(s => `<a href="#" data-sec="s${s.n}">§${s.n} ${LAW_SEC[s.n] || ''}<small>${esc(s.title)}</small></a>`).join('')}</aside>
      <div class="lawtext"><p class="note">Действующий текст закона — английский (<code>AGENTS.md</code>), одинаковый для всех движков. Заголовки разделов и запреты даны и по-русски; ссылки «§N» на доске ведут сюда.</p>
      <details class="sec"><summary>Вступление — что это за файл</summary><div class="md">${md(intro)}</div></details>
      ${secs.map(s => `<details class="sec" id="s${s.n}" ${anchor === 's' + s.n ? 'open' : ''}><summary><b>§${s.n} · ${LAW_SEC[s.n] || ''}</b> <small>${esc(s.title)}</small></summary><div class="md">${md(s.body)}</div>
        ${s.n === 5 ? `<div id="s5p"><h4>Запреты по-русски (кратко)</h4><ol>${PROHIB_RU.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>` : ''}</details>`).join('')}</div></div>`;
}
function lawBodyEngine(L) {
  return `<p class="note"><code>.claude/rules/claude-8.md</code> — что верно только для Claude Code: где роли, как зовутся узлы, какие поля несут расход, хуки, MCP.</p><div class="md lawtext">${lawMd(L, L.DATA.law.engine)}</div>`;
}
function lawBodyRoutes(L) {
  const { DATA, esc, T, lbl, ROUTES } = L;
  return `<p class="note">Девять маршрутов. route-0…5 открываются только одобрением пяти полей человеком. Этапы — ключи строки <code>stage</code>; причина — код <code>why</code> (§6).</p>
      <div class="rgrid">${Object.entries(ROUTES).map(([k, R]) => `<div class="rcard"><div class="code">${esc(lbl(k))} <small>${k}</small>${/route-[0-5]/.test(k) ? ' · <span class="miss">одобрение человека</span>' : ''}</div><b>${esc(R[0])}</b>
        <div class="route">${R[1].map((s, i) => `${i ? '<span class="arrow">→</span>' : ''}<div class="stage"><small>${esc(T.stage[s[0]] || s[0])}</small>${esc(s[1])}</div>`).join('')}</div>
        <small>карточек: ${DATA.cards.filter(c => c.route === k).length}</small></div>`).join('')}</div>
      <h3>Коды причины</h3><dl class="kv">${Object.entries(T.why).map(([k, v]) => `<dt><code>${k}</code></dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <h3>Ключи этапа</h3><dl class="kv">${Object.entries(T.stage).filter(([k]) => k !== 'closed').map(([k, v]) => `<dt><code>${k}</code></dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <details class="sec"><summary><b>Справочник маршрутов</b> <small>.forma/manual/ru/03-forma/ROUTES.md</small></summary><div class="md">${lawMd(L, DATA.law.routes)}</div></details>`;
}
function lawBodyRoles(L, tab) {
  const { DATA, esc } = L, list = tab === 'roles' ? DATA.law.roles : DATA.law.onDemand;
  return `<p class="note">${tab === 'roles' ? 'Пять узлов и помощник: модель, усилие, инструменты, полный текст роли (<code>.claude/agents/</code>).' : 'Файлы, которые узел читает только в нужный момент (<code>.claude/agents/on-demand/</code>).'}</p>
      ${list.map(r => `<details class="sec role"><summary><b>${esc(r.name)}</b> <small>${esc(ROLE_RU[r.name] || r.desc)}</small>${r.model ? `<span class="tag">${esc(r.model)}</span>` : ''}${r.effort ? `<span class="tag">усилие: ${esc(r.effort)}</span>` : ''}</summary>
        ${r.tools ? `<div class="tools"><b>Инструменты:</b> ${r.tools.split(/,\s*/).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="meta">${esc(r.file)}</div><div class="md">${lawMd(L, r.body)}</div></details>`).join('')}`;
}
function lawBodyChecks(L) {
  const { esc } = L, LW = L.DATA.law;
  return `<p class="note"><code>node .claude/scripts/sync-engines.cjs --check</code> — машина, которая держит закон: сообщает о нарушении. Правило действует с даты в <code>.forma/living/checks.json</code>; более ранние карточки не проверяются.</p>
      <table class="tbl"><tr><th>Правило</th><th>Что проверяет</th><th>С даты</th></tr>${Object.entries(LW.checkDates).map(([k, d]) => `<tr><td><code>${k}</code></td><td>${esc(CHECK_RU[k] || '')}</td><td>${d}</td></tr>`).join('')}</table>
      <h3>Разделы проверки в sync-engines.cjs</h3><ul>${LW.checks.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      <p class="note">Ещё: паритет ролей Claude ↔ Gemini ↔ Codex, эпики доски, карточки в done без закрытия Core, обезличенность движка.</p>`;
}
function lawBodyProject(L) {
  const { DATA } = L;
  return `<p class="note"><code>project/PROJECT.md</code> — пороги (заходов ${DATA.thresholds.attempts ?? '—'}, объём круга ${DATA.thresholds.volume ?? '—'}), маршруты эпиков, внешние сервисы, язык.</p><div class="md lawtext">${lawMd(L, DATA.law.project)}</div>`;
}
function lawBodyManual(L) {
  return `<p class="note"><code>.forma/manual/ru/03-forma/PROTOCOL.md</code> — протокол для человека, по-русски.</p><div class="md lawtext">${lawMd(L, L.DATA.law.protocol)}</div>`;
}
function lawBodyHtml(L, anchor) {
  const tab = L.tab;
  if (tab === 'law') return lawBodyLaw(L, anchor);
  if (tab === 'engine') return lawBodyEngine(L);
  if (tab === 'routes') return lawBodyRoutes(L);
  if (tab === 'roles' || tab === 'ondemand') return lawBodyRoles(L, tab);
  if (tab === 'checks') return lawBodyChecks(L);
  if (tab === 'project') return lawBodyProject(L);
  if (tab === '.forma/manual') return lawBodyManual(L);
  return '';
}
function lawRender(L, anchor) {
  const el = document.getElementById('view-law');
  const nav = `<nav class="lawnav">${LAW_NAV.map(([k, n]) => `<span class="chip ${L.tab === k ? 'on' : ''}" data-lt="${k}">${n}</span>`).join('')}</nav>`;
  el.innerHTML = nav + lawBodyHtml(L, anchor);
  if (anchor) { const a = document.getElementById(anchor); if (a) { a.closest('details')?.setAttribute('open', ''); a.scrollIntoView({ block: 'start' }); } }
}
// Вкладка «Настройки» — контейнер, внутри подвкладки «Закон», «Движок», «Борт», «Структура» (переносятся как есть).
const SETTINGS_TABS = ['law', 'project', 'engine', 'structure'];
function settingsSetTab(tab) {
  SETTINGS_TABS.forEach(t => { const el = document.getElementById('view-' + t); if (el) el.hidden = t !== tab; });
  document.querySelectorAll('#settings-nav .chip').forEach(c => c.classList.toggle('on', c.dataset.stab === tab));
}
function settingsRender(L, tab, anchor) {
  settingsSetTab(tab);
  if (tab === 'law') { if (anchor) L.tab = 'law'; lawRender(L, anchor); }
}
// Вкладки наверху; «§N» на доске и в окнах — ссылка в закон (вкладка «Настройки», подвкладка «Закон»).
function lawSetView(L, v, settingsTab, anchor) {
  document.getElementById('view-board').hidden = v !== '.forma/board';
  document.getElementById('view-settings').hidden = v !== 'settings';
  for (const x of LX_PANELS) document.getElementById('view-' + x).hidden = v !== x;
  const tab = document.querySelector(`.tab[data-view="${v}"]`);
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.view === v));
  document.title = `${L.DATA.project} · ${v === '.forma/board' ? 'Канбан' : tab.textContent}`;
  // Переключение вкладки — это новая страница: старая прокрутка body, унаследованная
  // от предыдущей вкладки, иначе оставляет контент визуально «ниже» верхних вкладок.
  window.scrollTo(0, 0);
  if (v === 'settings') settingsRender(L, settingsTab || L.settingsTab || 'law', anchor);
  try { history.replaceState(null, '', v === '.forma/board' ? '#' : '#' + v); } catch { /* адрес не меняется (file://, песочница) — вкладка всё равно переключена */ }
}
function lawInit({ DATA, esc, T, lbl, ROUTES }) {
  const L = { DATA, esc, T, lbl, ROUTES, tab: 'law', settingsTab: 'law' };
  document.getElementById('view-law').onclick = e => {
    const t = e.target.closest('[data-lt]'); if (t) { L.tab = t.dataset.lt; lawRender(L); return; }
    const s = e.target.closest('[data-sec]'); if (s) { e.preventDefault(); lawRender(L, s.dataset.sec); }
  };
  document.querySelector('.tabs').onclick = e => { const t = e.target.closest('.tab'); if (t) lawSetView(L, t.dataset.view); };
  document.getElementById('settings-nav').onclick = e => {
    const t = e.target.closest('.chip'); if (!t) return;
    L.settingsTab = t.dataset.stab; settingsRender(L, L.settingsTab);
  };
  const linkLaw = html => html.replace(/§\s?([1-8])(?![^<]*>)/g, (m, n) => `<a href="#" class="lawlink" data-law="${n}">${m}</a>`);
  if (window.lawClick) document.removeEventListener('click', window.lawClick);
  document.addEventListener('click', window.lawClick = e => {
    const a = e.target.closest('.lawlink'); if (!a) return; e.preventDefault();
    document.getElementById('dlg').close?.();
    L.settingsTab = 'law';
    if (a.dataset.law === '8') { L.tab = 'engine'; lawSetView(L, 'settings', 'law'); } else lawSetView(L, 'settings', 'law', 's' + a.dataset.law);
  });
  { const h = location.hash.slice(1); if (['settings', 'interview', 'nodes', 'docs', 'economy', 'graphs'].includes(h)) lawSetView(L, h); }
  return { linkLaw };
}
