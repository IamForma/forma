// Вкладка «Структура»: файлы настроек (карточки) и деревья каталогов с попапом «что это» у каждого узла (structure.cjs).
const STRUCT_INFO = [];
const WHO = { human: ["правит человек", "st-k-static"], nodes: ["ведут узлы", "st-k-dynamic"], secret: ["секрет: только имя", "st-secret"] };
function structIcon(n){
  if (n.dir) return "📁";
  const e = (n.name.match(/\.([^.]+)$/) || [])[1];
  return ({ md: "📄", json: "🧾", cjs: "⚙️", js: "⚙️", sh: "⚙️", py: "⚙️", html: "🌐", css: "🎨" })[e] || "▫️";
}
function structReg(n){ STRUCT_INFO.push(n); return STRUCT_INFO.length - 1; }
function structHelp(n){
  const has = n.note || n.desc;
  return `<button class="st-help${has ? "" : " st-nohelp"}" data-si="${structReg(n)}" title="что это">?</button>`;
}
function structNodeHtml(n){
  const note = (n.note ? `<span class="st-note">${esc(n.note)}</span>` : "") + (n.mixed ? `<span class="st-mix-tag" title="ведётся динамика: ${esc(n.mixed)}">смешано</span>` : "");
  const k = n.kind ? ` st-k-${esc(n.kind)}` : "";
  const nm = `<span class="st-ic">${structIcon(n)}</span><span class="st-name">${esc(n.name)}${n.dir ? "/" : ""}</span>`;
  if (!n.dir) return `<li class="st-file${k}">${nm}${note}${structHelp(n)}</li>`;
  const kids = (n.children || []).map(structNodeHtml).join("") + (n.more ? `<li class="st-more">… ещё ${n.more}</li>` : "");
  const head = `${nm}<span class="st-count">${n.files}</span>${note}${structHelp(n)}`;
  return kids ? `<li class="st-dir${k}"><details><summary>${head}</summary><ul>${kids}</ul></details></li>`
              : `<li class="st-dir st-leaf${k}">${head}</li>`;
}
function structSettingsCard(f){
  const w = WHO[f.who] || ["", ""];
  const meta = !f.exists ? `<span class="st-miss">файла нет</span>` : `<span class="dim">${f.dir ? f.files + " файл." : (f.size / 1024).toFixed(1) + " КБ"} · ${esc(f.mtime || "")}</span>`;
  return `<div class="st-card"><div class="st-card-h"><span class="st-ic">${structIcon({ dir: f.dir, name: f.rel })}</span><b>${esc(f.rel)}</b>${f.exists ? structHelp(f) : ""}</div>
    <div class="st-card-n">${esc(f.note)}</div><div class="st-card-f"><span class="st-who ${w[1]}">${w[0]}</span>${meta}</div></div>`;
}
function structureHtml(s){
  if (!s || !s.groups) return `<section class="nodes-card"><h2>Структура</h2><div class="node-empty">Нет данных.</div></section>`;
  STRUCT_INFO.length = 0;
  const cards = (s.settingsFiles || []).map(structSettingsCard).join("");
  const kinds = (s.projectKinds || []).map(k => `<section class="nodes-card st-col st-kind-${esc(k.key)}"><h2>${esc(k.title)}</h2>
    <div class="dim">${esc(k.note)}</div><ul class="st-tree">${k.items.map(i => `<li><span class="st-ic">${structIcon(i)}</span><span class="st-name">${esc(i.name)}${i.dir ? "/" : ""}</span>${i.dir ? `<span class="st-count">${i.files}</span>` : ""}${i.note ? `<span class="st-note">${esc(i.note)}</span>` : ""}${structHelp(i)}${i.mixed ? `<div class="st-mixed">смешано: ведётся динамика — ${esc(i.mixed)}</div>` : ""}</li>`).join("")}</ul></section>`).join("");
  const legend = `<div class="st-legend">${(s.legend || []).map(l => `<span class="st-k-${esc(l.key)}">${esc(l.title)}</span>`).join("")}<span class="st-mix-tag">смешано</span></div>`;
  const trees = s.groups.map(g => `<section class="nodes-card st-col"><h2>${esc(g.title)}</h2>
    <div class="dim">${esc(g.note)}</div>${g.key === "project" ? legend : ""}<ul class="st-tree">${g.roots.map(structNodeHtml).join("")}</ul></section>`).join("");
  return `<h2 class="st-h">Файлы настроек</h2><div class="st-cards">${cards}</div>
    <h2 class="st-h">Корень проекта: статика и динамика</h2><div class="st-grid">${kinds}</div>
    <div class="st-bar"><h2 class="st-h">Каталоги системы</h2><input id="st-q" type="search" placeholder="поиск по имени…"><button id="st-open">развернуть всё</button><button id="st-close">свернуть всё</button></div>
    <div class="st-grid" id="st-trees">${trees}</div>`;
}
function structPopup(n){
  const d = document.getElementById("dlg");
  const rows = [["Путь", n.rel], ["Тип", n.dir ? "папка · " + n.files + " файл." : "файл" + (n.size != null ? " · " + (n.size / 1024).toFixed(1) + " КБ" : "")], ["Изменён", n.mtime]]
    .filter(r => r[1]).map(r => `<tr><td class="dim">${r[0]}</td><td><code>${esc(r[1])}</code></td></tr>`).join("");
  const who = WHO[n.who] ? `<p><span class="st-who ${WHO[n.who][1]}">${WHO[n.who][0]}</span></p>` : "";
  d.innerHTML = `<div class="st-pop"><h3>${esc(n.name)}</h3>${who}
    <p>${n.note ? esc(n.note) : '<span class="dim">описание в справочнике не задано</span>'}</p>
    ${n.desc ? `<p class="dim">Из самого файла: ${esc(n.desc)}</p>` : ""}
    <table>${rows}</table><button onclick="document.getElementById('dlg').close()">закрыть</button></div>`;
  if (d.open) d.close();
  d.showModal();
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest(".st-help");
  if (b) { e.preventDefault(); e.stopPropagation(); structPopup(STRUCT_INFO[+b.dataset.si]); return; }
  if (e.target.id === "st-open" || e.target.id === "st-close")
    document.querySelectorAll("#st-trees details").forEach(x => x.open = e.target.id === "st-open");
});
document.addEventListener("input", e => {
  if (e.target.id !== "st-q") return;
  const q = e.target.value.trim().toLowerCase();
  const lis = document.querySelectorAll("#st-trees li");
  lis.forEach(li => { li.hidden = !!q && !li.textContent.toLowerCase().includes(q); });
  if (q) document.querySelectorAll("#st-trees details").forEach(d => { d.open = !d.parentElement.hidden; });
});
