// Вкладка «Структура»: файлы настроек (карточки) и деревья каталогов с попапом «что это» у каждого узла (structure.cjs).
const STRUCT_INFO = [];
const WHO_DEF = { human: ["st.who.human", "st-k-static"], nodes: ["st.who.nodes", "st-k-dynamic"], secret: ["st.who.secret", "st-secret"] };
const whoOf = (k) => WHO_DEF[k] ? [t(WHO_DEF[k][0]), WHO_DEF[k][1]] : null;
const structSize = (n) => t('st.kb', {n: (n / 1024).toFixed(1)});
function structIcon(n){
  if (n.dir) return "📁";
  const e = (n.name.match(/\.([^.]+)$/) || [])[1];
  return ({ md: "📄", json: "🧾", cjs: "⚙️", js: "⚙️", sh: "⚙️", py: "⚙️", html: "🌐", css: "🎨" })[e] || "▫️";
}
function structReg(n){ STRUCT_INFO.push(n); return STRUCT_INFO.length - 1; }
function structHelp(n){
  const has = n.note || n.desc;
  return `<button class="st-help${has ? "" : " st-nohelp"}" data-si="${structReg(n)}" title="${esc(t('st.what'))}">?</button>`;
}
function structNodeHtml(n){
  const note = (n.note ? `<span class="st-note">${esc(n.note)}</span>` : "") + (n.mixed ? `<span class="st-mix-tag" title="${esc(t('st.mixedTitle', {x: n.mixed}))}">${t('st.mixed')}</span>` : "");
  const k = n.kind ? ` st-k-${esc(n.kind)}` : "";
  const nm = `<span class="st-ic">${structIcon(n)}</span><span class="st-name">${esc(n.name)}${n.dir ? "/" : ""}</span>`;
  if (!n.dir) return `<li class="st-file${k}">${nm}${note}${structHelp(n)}</li>`;
  const kids = (n.children || []).map(structNodeHtml).join("") + (n.more ? `<li class="st-more">${t('st.more', {n: n.more})}</li>` : "");
  const head = `${nm}<span class="st-count">${n.files}</span>${note}${structHelp(n)}`;
  return kids ? `<li class="st-dir${k}"><details><summary>${head}</summary><ul>${kids}</ul></details></li>`
              : `<li class="st-dir st-leaf${k}">${head}</li>`;
}
function structSettingsCard(f){
  const w = whoOf(f.who) || ["", ""];
  const meta = !f.exists ? `<span class="st-miss">${t('st.noFile')}</span>` : `<span class="dim">${f.dir ? t('st.files', {n: f.files}) : structSize(f.size)} · ${esc(f.mtime || "")}</span>`;
  return `<div class="st-card"><div class="st-card-h"><span class="st-ic">${structIcon({ dir: f.dir, name: f.rel })}</span><b>${esc(f.rel)}</b>${f.exists ? structHelp(f) : ""}</div>
    <div class="st-card-n">${esc(f.note)}</div><div class="st-card-f"><span class="st-who ${w[1]}">${w[0]}</span>${meta}</div></div>`;
}
// Заголовок и пояснение группы/рода: перевод по ключу, запас — то, что отдал сервер (группы адаптеров).
const stTr = (pre, key, part, fb) => { const k = `st.${pre}.${key}.${part}`, v = t(k); return v === k ? fb : v; };

function structureHtml(s){
  if (!s || !s.groups) return `<section class="nodes-card"><h2>${t('st.title')}</h2><div class="node-empty">${t('st.none')}</div></section>`;
  STRUCT_INFO.length = 0;
  const cards = (s.settingsFiles || []).map(structSettingsCard).join("");
  const kinds = (s.projectKinds || []).map(k => `<section class="nodes-card st-col st-kind-${esc(k.key)}"><h2>${esc(stTr('k', k.key, 'title', k.title))}</h2>
    <div class="dim">${esc(stTr('k', k.key, 'note', k.note))}</div><ul class="st-tree">${k.items.map(i => `<li><span class="st-ic">${structIcon(i)}</span><span class="st-name">${esc(i.name)}${i.dir ? "/" : ""}</span>${i.dir ? `<span class="st-count">${i.files}</span>` : ""}${i.note ? `<span class="st-note">${esc(i.note)}</span>` : ""}${structHelp(i)}${i.mixed ? `<div class="st-mixed">${t('st.mixedDyn', {x: esc(i.mixed)})}</div>` : ""}</li>`).join("")}</ul></section>`).join("");
  const legend = `<div class="st-legend">${(s.legend || []).map(l => `<span class="st-k-${esc(l.key)}">${esc(stTr('k', l.key, 'title', l.title))}</span>`).join("")}<span class="st-mix-tag">${t('st.mixed')}</span></div>`;
  const trees = s.groups.map(g => `<section class="nodes-card st-col"><h2>${esc(stTr('g', g.key, 'title', g.title))}</h2>
    <div class="dim">${esc(stTr('g', g.key, 'note', g.note))}</div>${g.key === "project" ? legend : ""}<ul class="st-tree">${g.roots.map(structNodeHtml).join("")}</ul></section>`).join("");
  return `<h2 class="st-h">${t('st.settingsFiles')}</h2><div class="st-cards">${cards}</div>
    <h2 class="st-h">${t('st.rootKinds')}</h2><div class="st-grid">${kinds}</div>
    <div class="st-bar"><h2 class="st-h">${t('st.sysDirs')}</h2><input id="st-q" type="search" placeholder="${esc(t('st.search'))}"><button id="st-open">${t('st.openAll')}</button><button id="st-close">${t('st.closeAll')}</button></div>
    <div class="st-grid" id="st-trees">${trees}</div>`;
}
function structPopup(n){
  const d = document.getElementById("dlg");
  const rows = [[t('st.row.path'), n.rel], [t('st.row.type'), n.dir ? t('st.row.dir', {files: t('st.files', {n: n.files})}) : t('st.row.file') + (n.size != null ? " · " + structSize(n.size) : "")], [t('st.row.changed'), n.mtime]]
    .filter(r => r[1]).map(r => `<tr><td class="dim">${r[0]}</td><td><code>${esc(r[1])}</code></td></tr>`).join("");
  const wo = whoOf(n.who), who = wo ? `<p><span class="st-who ${wo[1]}">${wo[0]}</span></p>` : "";
  d.innerHTML = `<div class="st-pop"><h3>${esc(n.name)}</h3>${who}
    <p>${n.note ? esc(n.note) : `<span class="dim">${t('st.noDesc')}</span>`}</p>
    ${n.desc ? `<p class="dim">${t('st.fromFile', {d: esc(n.desc)})}</p>` : ""}
    <table>${rows}</table><button onclick="document.getElementById('dlg').close()">${t('st.close')}</button></div>`;
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
