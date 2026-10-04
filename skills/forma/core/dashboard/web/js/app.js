// Точка входа: получение среза данных, живое обновление, раскладка по панелям.

let latestData = null;

// --- Панели рабочего дашборда: данные — общий срез generate.js (data.json / SSE) ---
const LX_PANELS = ["interview","nodes","docs","economy","graphs"];
function renderPanels(d) {
  latestData = d;
  document.getElementById('interview').innerHTML = interviewHtml(d.interview);
  document.getElementById('nodes').innerHTML = formaHtml(d.formaCatalog);
  document.getElementById('docs').innerHTML = docsHtml(d);
  docsBind();
  document.getElementById('chain').innerHTML = chainHtml(d.chain);
  document.getElementById('structure').innerHTML = structureHtml(d.structure);
  document.getElementById('project').innerHTML = projectSettingsHtml(d.settings && d.settings.project);
  document.getElementById('engine').innerHTML = engineSettingsHtml(d.settings && d.settings.engine);
  // Экономика: сверху — прежняя главная (плитки, статусы, оснастка и расход узлов…), ниже — прежняя «Экономика»
  renderEconomy(d);
  // Графы: вкладка рисуется один раз — открытый граф не перезагружается на каждом обновлении
  if (!graphShown) {
    document.getElementById('graphs').innerHTML = `<nav class="side-tabs">${[['.forma/manual','app.graph.manual'],['engine','app.graph.engine'],['done-cards','app.graph.experience'],['project','app.graph.project'],['site','app.graph.site']].map(([c,k]) => `<button class="side-tab" data-c="${c}">${t(k)}</button>`).join('')}</nav><div id="gp"></div>`;
    showGraph(graphShown = '.forma/manual');
  }
}
function renderAll(d) { renderPanels(d); boardInit(d.board); }
i18nInit().then(() => fetch('./data.json')).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(renderAll)
  .catch(err => { document.getElementById('main').textContent = t('app.loadFail', {err: String(err)}); });
// Смена языка — перерисовка последнего среза данных на новом языке.
document.addEventListener('i18n', () => { if (latestData) renderAll(latestData); });
// Живое обновление: serve.js пушит полный срез при каждой правке карточки. Первое сообщение — те же данные, что дал fetch.
if (window.EventSource) {
  let first = true;
  new EventSource('/events').onmessage = e => { if (first) { first = false; return; } renderAll(JSON.parse(e.data)); };
}

(function(){var h=document.querySelector("header");function s(){document.documentElement.style.setProperty("--hh",h.offsetHeight+"px")}s();new ResizeObserver(s).observe(h)})();
