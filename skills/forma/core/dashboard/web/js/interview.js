// Вкладка «Интервью»: живая картина проекта к брифу, разбор Markdown документа идеи.

// ---------------------------------------------------------------- интервью ---
// Живая картина проекта к брифу.
//   Q1·D  пять позиций слева, дерево предмета справа;
//   Q2·B  перерисовка по раунду ответов (раунд приходит в данных, не по фразе);
//   Q4·C  догадка помечается поузлово, а не областью;
//   Q5·C  у догадки ровно два действия — подтвердить и отклонить;
//   Q6·C/Q7·B неподтверждённое к концу интервью уходит в «ещё не уточнено» рядом с брифом.
// `updated` в картине — настоящий ISO с зоной, а timeAgo() выше разбирает свой формат
// «ГГГГ-ММ-ДД ЧЧ:ММ» и намеренно не трогает часовые пояса. Расширять его под второй формат
// значило бы завести в одной функции две разные договорённости о том, что такое время.
function agoIso(iso){
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const min = (Date.now() - t) / 60000;
  if (min < 1) return 'только что';
  if (min < 60) return Math.round(min) + ' мин назад';
  if (min < 48 * 60) return Math.round(min / 60) + ' ч назад';
  return Math.round(min / 1440) + ' дн назад';
}

const POS_STATE_LABEL = {answered:'отвечено', now:'отвечаете сейчас', available:'можно отвечать', blocked:'ждёт', ready:'к сверке', sent:'ответ отправлен', partial:'отвечено частично'};
const POS_STATE_CLASS_MAP = {answered:'full', now:'now', available:'available', blocked:'blocked', ready:'ready', sent:'sent', partial:'sent'};

// Доска показывает результат, а не список неулаженного. Узел, о котором ещё не
// договорились, помечен «уточняется» — это сведение, а не предложение решить:
// решается он вопросом в интервью, а не кликом здесь.
function guessTagHtml(status){
  if(status === 'confirmed') return '<span class="tag">подтверждено</span>';
  if(status === 'rejected') return '<span class="tag">отклонено</span>';
  return '<span class="tag">уточняется</span>';
}

function treeNodeHtml(n){
  if(!n) return '';
  const kind = n.kind || 'said';
  const st = n.status || 'open';
  let cls = 'node';
  if(n.role) cls += ' ' + n.role;                 // root | part | fn
  if(kind === 'pending') cls += ' pending';
  else if(kind === 'guess') cls += st === 'confirmed' ? ' confirmed' : st === 'rejected' ? ' rejected' : ' guess';
  else cls += ' said';
  if(n.fresh) cls += ' fresh';

  const tag = kind === 'guess' ? guessTagHtml(st) : (n.tag ? `<span class="tag">${esc(n.tag)}</span>` : '');
  const from = n.from ? ` <span class="from">← ${esc(n.from)}</span>` : '';
  const kids = (n.children && n.children.length)
    ? `<ul>${n.children.map(treeNodeHtml).join('')}</ul>` : '';
  // Раскрутить можно то, что человек сказал: догадка и ожидание — ещё не материал.
  const grow = (kind === 'said' && n.id)
    ? `<button class="grow-btn" title="Раскрутить этот пункт в интервью" onclick="expandNode('${esc(n.id)}')">+</button>`
    : '';
  return `<li><span class="${cls}">${esc(n.label || '')} ${tag}</span>${grow}${from}${kids}</li>`;
}

function posHtml(p){
  const cls = POS_STATE_CLASS_MAP[p.state] || 'blocked';

  // Три разных случая, и путать их нельзя: ответ человека, объяснение чего ждут,
  // подсказка о чём спросят.
  let body;
  if (p.text) body = `<p class="pos-text">${esc(p.text)}</p>`;
  else if (p.state === 'blocked' && p.waitingFor.length)
    body = `<p class="pos-hint">Ждёт ${p.waitingFor.map(n => 'позицию ' + n).join(' и ')}: ${esc(p.hint)}</p>`;
  else body = `<p class="pos-hint">${esc(p.hint)}</p>`;

  // Сколько вопросов захода закрыто: «отвечено» о позиции, у которой два вопроса
  // ещё открыты, — неправда, и человеку надо видеть, что именно осталось.
  const asked = (p.questions || []).length;
  const got = (p.questions || []).filter((q) => q.given).length;
  if (asked) body += `<p class="pos-hint">Вопросов захода: ${got} из ${asked} отвечено.</p>`;

  // Слои позиций 3 и 4 — видно, что заходов здесь два, а не один.
  const layers = p.layers && p.layers.length
    ? `<ul class="layers">${p.layers.map(l => `<li class="layer${l.answered ? ' done' : ''}">
        <span class="lk">${esc(l.label || l.key)}</span><span>${esc(l.text || l.hint)}</span></li>`).join('')}</ul>`
    : '';

  // Кнопка только у того, кого спрашивают, и только когда предпосылки осели.
  // У пятой позиции её нет никогда: маршрут — работа `Intent`, и звать человека
  // отвечать за узел значило бы перекладывать на него чужую работу.
  // Кнопка только у того, кого спрашивают, и только когда предпосылки осели.
  // Вопросов для позиции ещё нет — кнопка говорит это прямо, а не открывает
  // пустую форму: раунды позиций пишутся вместе с человеком, когда до них
  // доходит очередь.
  let open = '';
  // Закрытая позиция кнопки не получает. Её сессия отработана и не возобновляется:
  // «Открыть интервью» здесь обещало бы продолжение того разговора, а продолжить его
  // нельзя — он закончен и записан. Понадобится уточнение — это новый заход, и заводит
  // его `Intent`, после чего позиция перестаёт быть закрытой и кнопка вернётся сама.
  if (p.asks === 'human' && p.state !== 'blocked' && p.state !== 'answered') {
    open = p.questions.length
      ? `<div class="pos-open">
          <button class="ghost-btn" data-pos="${p.n}" onclick="openPosition(${p.n})">${
            p.session && p.session.alive
              ? 'Перейти в интервью &rarr;'
              : p.session ? 'Поднять интервью заново &rarr;' : 'Открыть интервью &rarr;'
          }</button>
          ${p.session && !p.session.alive
            // Адрес живой сессии рядом с кнопкой не пишется: он вёл туда же, куда она.
            // Два пути к одному месту — не выбор, а шум рядом с действием. Сказать
            // стоит только о том, чего по кнопке не видно: страница не отвечает.
            ? `<span class="sess dead">страница интервью не отвечает — кнопка поднимет её заново</span>` : ''}
        </div>`
      : `<p class="pos-note">Вопросы этого захода ещё не написаны — они составляются вместе с человеком, когда до позиции доходит очередь.</p>`;
  }

  // У закрытой позиции вместо кнопки — то единственное, что здесь ещё имеет значение:
  // куда лёг результат. Дальше смотрят туда, а не сюда.
  // Закрытая позиция закрыта не навсегда. Возобновление — не продолжение того же
  // разговора (он записан и сдан), а новый заход по этой же позиции: один открытый
  // вопрос о том, что человек хочет добавить, дальше раскручивается вопросами.
  const done = p.state === 'answered'
    ? `<div class="pos-open">
        <button class="ghost-btn resume-btn" data-pos="${p.n}" onclick="openPosition(${p.n}, true)">Возобновить &rarr;</button>
        <span class="sess done">записано в <code>project/brief/interview.md</code></span>
      </div>`
    : '';

  const note = p.note ? `<p class="pos-note">${esc(p.note)}</p>` : '';

  let guess = '';
  if(p.guess){
    const st = p.guess.status || 'open';
    const style = st === 'rejected' ? ' style="opacity:.45"' : '';
    guess = `<div class="pos-guess"${style}>
      <span class="guess-mark">${st === 'confirmed' ? 'подтверждено' : st === 'rejected' ? 'отклонено' : 'догадка'}</span>
      <p>${esc(p.guess.text || '')}</p>
    </div>`;
  }

  return `<div class="pos ${cls}">
    <div class="pos-head"><span class="pos-n mono">${p.n}</span><span class="pos-name">${esc(p.name)}</span><span class="pos-state">${POS_STATE_LABEL[p.state] || ''}</span></div>
    <div class="pos-fill"><i style="width:${p.fill}%"></i></div>
    ${body}${layers}${guess}${note}${done}${open}
  </div>`;
}

// Какая сторона показана справа. Выбор переживает пересборку данных, но не
// перезагрузку страницы: это взгляд, а не состояние проекта.
let sideView = 'tree';
function setSideView(v){
  sideView = v;
  if (latestData) document.getElementById('interview').innerHTML = interviewHtml(latestData.interview);
}

// Крошечный разбор Markdown — ровно то, чем пишется документ идеи: заголовки,
// списки, таблицы, цитаты, жирное и курсив. Полноценная библиотека сюда не тянется:
// у дашборда нет сборки и нет зависимостей, и заводить их ради одного файла нечем.
function mdHtml(src){
  const esc2 = (t) => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline = (t) => esc2(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
  const out = [];
  const lines = String(src).split(/\r?\n/);
  let list = null, quote = false, table = null;
  // Строки копятся, пока абзац не кончится пустой строкой или чем-то другим.
  let para = [];
  const closePara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  let qpara = [];
  const closeQPara = () => { if (qpara.length) { out.push('<p>' + inline(qpara.join(' ')) + '</p>'); qpara = []; } };
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  const closeQuote = () => { closeQPara(); if (quote) { out.push('</blockquote>'); quote = false; } };
  const closeTable = () => { if (table) { out.push('</tbody></table>'); table = null; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    // Таблица: строка-разделитель отделяет шапку от тела.
    if (/^\|/.test(l)) {
      closePara();
      const cells = l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (/^[-: ]+$/.test(cells.join(''))) continue;        // разделитель
      if (!table) { closeList(); closeQuote(); out.push('<table><tbody>'); table = 1; }
      out.push('<tr>' + cells.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>');
      continue;
    }
    closeTable();
    if (!l.trim()) { closePara(); closeList(); closeQuote(); continue; }
    if (/^---+$/.test(l)) { closePara(); closeList(); closeQuote(); out.push('<hr>'); continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { closePara(); closeList(); closeQuote(); out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); continue; }
    const q = /^>\s?(.*)$/.exec(l);
    // В цитате пустая строка тоже разделяет абзацы — иначе весь блок слипнется в один.
    if (q) { closePara(); closeList(); if (!quote) { out.push('<blockquote>'); quote = true; }
      if (q[1].trim()) qpara.push(q[1]); else closeQPara();
      continue; }
    const li = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(l);
    if (li) {
      closePara();
      const want = /^\d/.test(li[1]) ? 'ol' : 'ul';
      if (list && list !== want) closeList();
      if (!list) { out.push('<' + want + '>'); list = want; }
      out.push('<li>' + inline(li[2]) + '</li>');
      continue;
    }
    closeList(); closeQuote();
    para.push(l.trim());
  }
  closePara(); closeList(); closeQuote(); closeTable();
  return out.join('');
}

// Пункт дерева становится темой следующего вопроса.
//
// Человек смотрит на разобранное дерево и видит, где сказано мало. Спрашивать его
// при этом «о чём ещё поговорим» значило бы заставлять вспоминать то, что у него
// перед глазами. Вопрос собирается из самого пункта, на сервере.
function expandNode(id){
  fetch('/interview/expand?node=' + encodeURIComponent(id)).then(r => r.json()).then(r => {
    if (!r.ok) { alert('Не раскрутилось: ' + r.error); return; }
    const w = window.open(r.url, 'forma-grill-' + r.position);
    if (!w) alert('Браузер не дал открыть вкладку. Адрес интервью: ' + r.url);
  }).catch(e => alert('Не раскрутилось: ' + e));
}

// Кнопка ведёт в привычный формат разговора — страницу интервью
// `forma-grill-with-ui`, отдельной вкладкой. Формы внутри дашборда намеренно нет:
// два места ввода под одни и те же вопросы — это и есть усталость от разных
// окошек, ради которой всё сведено в один канал.
//
function openPosition(n, resume){
  const btn = document.querySelector(`#interview [data-pos="${n}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Открываю…'; }
  fetch('/interview/open?position=' + n + (resume ? '&resume=1' : '')).then(r => r.json()).then(r => {
    if (btn) { btn.disabled = false; btn.textContent = 'Открыть интервью \u2192'; }
    if (!r.ok) { alert('Интервью не открылось: ' + r.error); return; }
    // Именованное окно, а не безымянное: второй клик по той же позиции вернёт
    // ту же вкладку, а не заведёт вторую страницу одного разговора.
    const w = window.open(r.url, 'forma-grill-' + n);
    if (!w) alert('Браузер не дал открыть вкладку. Адрес интервью: ' + r.url);
  }).catch(e => {
    if (btn) { btn.disabled = false; btn.textContent = 'Открыть интервью \u2192'; }
    alert('Интервью не открылось: ' + e);
  });
}

function interviewRightHtml(iv){
  return `<div class="live-right">
    <div class="side-tabs">
      <button class="side-tab${sideView === 'tree' ? ' on' : ''}" onclick="setSideView('tree')">Дерево</button>
      <button class="side-tab${sideView === 'idea' ? ' on' : ''}" onclick="setSideView('idea')">Идея</button>
      <button class="side-tab${sideView === 'prompt' ? ' on' : ''}" onclick="setSideView('prompt')">Промпт</button>
    </div>
    <div class="side-pane" style="display:${sideView === 'prompt' ? 'block' : 'none'}">
      ${iv.landingPrompt && iv.landingPrompt.trim()
        ? '<div class="idea-doc">' + mdHtml(iv.landingPrompt) + '</div>'
        : '<p class="pos-text" style="font-style:italic">Промпт первой страницы ещё не написан — он пишется по ходу интервью, по мере ответов.</p>'}
      <p class="tree-foot">Правится после каждой отправки, на Finish сверяется со всеми ответами. Непроверенное помечено «догадка». Файл: <code>project/brief/landing-prompt.md</code>.</p>
    </div>
    <div class="side-pane" style="display:${sideView === 'idea' ? 'block' : 'none'}">
      ${iv.idea
        ? '<div class="idea-doc">' + mdHtml(iv.idea) + '</div>'
        : '<p class="pos-text" style="font-style:italic">Документ ещё не написан — он появится, когда будет из чего его собрать.</p>'}
      <p class="tree-foot">Пишется заново после каждого разбора ответа. Запись того, что сказано, — отдельно и не меняется: <code>project/brief/interview.md</code>.</p>
    </div>
    <div class="side-pane" style="display:${sideView === 'tree' ? 'block' : 'none'}">
    <p class="col-title">Дерево предмета · сплошной контур — сказано человеком, пунктир — догадка агента</p>
    <div class="tree">${iv.tree ? '<ul>' + treeNodeHtml(iv.tree) + '</ul>' : '<p class="pos-text" style="font-style:italic">Дерева ещё нет — первая позиция не отвечена.</p>'}</div>
    <p class="tree-foot">Из этого дерева потом вырастают цели и эпики во вкладке «Цепь». Пустые ветки — не ошибка, а то, о чём ещё не спросили.</p>
    <p class="limit-note">У догадки ровно два действия: <b>&#10003;</b> подтвердить и <b>&#10005;</b> отклонить.
    Переименовать, перетащить или добавить узел здесь нельзя — намеренно: картина правится словом в интервью, не мышью.</p>
    </div>
  </div>`;
}

// С доски можно прыгнуть в интервью — там, и только там, уточняется неясное.
function interviewUnconfHtml(iv){
  const open = (iv.positions || []).find((x) => x.asks === 'human' && x.questions && x.questions.length
    && (x.state === 'available' || x.state === 'sent' || x.state === 'answered'));
  return `<div class="unconf">
    <span>Неясное уточняется вопросом в интервью, не кликом здесь.</span>
    <span class="spacer" style="flex:1"></span>
    ${open ? (open.session && open.session.alive
      ? `<a class="sess live" href="${esc(open.session.url)}" target="forma-grill-${open.n}">интервью открыто: ${esc(open.session.url)}</a>`
      : `<button class="ghost-btn" data-pos="${open.n}" onclick="openPosition(${open.n})">Открыть интервью &rarr;</button>`) : ''}
  </div>`;
}

function interviewHtml(iv){
  if(!iv) return '';

  // Интервью не идёт — но скелет показывается всё равно: человеку видно, о чём
  // спросят, и он может собраться с мыслями до разговора, а не в нём.
  const off = !iv.present;
  const warn = off
    ? (iv.reason === 'bad-json'
        ? `<div class="load-error">Картина есть, но не читается: <code>project/brief/picture.json</code> — ${esc(iv.error || 'сломанный JSON')}. Ниже скелет, а не ваши ответы.</div>`
        : `<p class="pos-hint" style="margin:0 0 14px">Интервью к брифу ещё не проводилось — <code>project/brief/interview.md</code> пуст. Ниже то, о чём спросят; первые две позиции можно закрывать прямо сейчас.</p>`)
    : '';

  const head = `<div class="live-head">
    <h2>Живая картина проекта — интервью к брифу</h2>
    <span class="spacer"></span>
    <span class="refresh" title="Картина перерисовывается по отправке раунда ответов, не по фразе">
      <span class="dot"></span> ${off ? 'интервью не начато' : (iv.round != null ? 'обновлено по <b>раунду ' + iv.round + '</b>' : 'раунд не указан')}${iv.updated ? ' · <b>' + agoIso(iv.updated) + '</b>' : ''}
    </span>
  </div>`;

  const left = `<div class="live-left">
    <p class="col-title">Пять позиций · ${iv.answered} из 5 отвечено</p>
    ${iv.positions.map(posHtml).join('')}
  </div>`;

  const foot = `<div class="live-foot">
    <span>Наполняет шаг цепи <b>«1 Бриф (интервью)»</b>.</span>
    <span class="spacer" style="flex:1"></span>
    <span class="mini">${iv.guesses.open ? 'уточняется узлов: ' + iv.guesses.open : 'неулаженного нет'}</span>
  </div>`;

  return warn + `<section class="live">${head}<div class="live-body">${left}${interviewRightHtml(iv)}</div>${interviewUnconfHtml(iv)}${foot}</section>`;
}
