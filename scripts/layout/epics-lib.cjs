// Общий модуль для скриптов перестройки эпиков: читает epics-map.json, собирает из него
// упорядоченные правила замены и применяет их к тексту. Сам ничего не пишет на диск.
// Используют: epics-map-check.cjs (P2), epics-rename.cjs / epics-verify.cjs (P3).
'use strict';
const fs = require('fs');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = (list) => [...list].sort((a, b) => b.length - a.length).map(esc).join('|');

const loadMap = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// не трогать имя, за которым уже стоит продолжение нового имени (Production -> Production channels)
const notNew = (k, lang) => {
  if (!lang) return '';
  const nn = k.new[lang];
  const suf = k.old.names[lang].filter((n) => nn.startsWith(n) && nn.length > n.length).map((n) => esc(nn.slice(n.length)));
  return suf.length ? '(?!(?:' + suf.join('|') + '))' : '';
};

const fill = (tpl, k, lang, map) => tpl
  .split('%N%').join(String(k.n))
  .split('%OLD%').join(esc(k.old.code))
  .split('%OLDNAMES%').join(lang ? alt(k.old.names[lang]) : '')
  .split('%MARKERS%').join(alt(map.markers))
  .split('%NOTNEW%').join(notNew(k, lang));

// Шаблоны карты -> конкретные правила (по виду и, где нужно, по языку имени)
function compile(map) {
  const rules = [];
  const oldCodes = map.kinds.map((k) => k.old.code);
  for (const t of map.ruleTemplates) {
    const base = { id: t.id, layers: t.layers || '*', wave: t.wave, confirm: !!t.confirm, skipFiles: (t.skipFiles || []).map((x) => new RegExp(x)) };
    if (t.type === 'line-array') { rules.push({ ...base, type: 'line-array', kinds: map.kinds, oldCodes }); continue; }
    for (const k of map.kinds) {
      if (t.onlyKinds && !t.onlyKinds.includes(k.n)) continue;
      for (const lang of t.perLang ? ['ru', 'en'] : [null]) {
        const re = new RegExp(fill(t.pattern, k, lang, map), t.flags || 'gu');
        const repl = t.replacement.split('%N%').join(String(k.n)).split('%NEWNAME%').join(lang ? k.new[lang] : '').split('%NEW%').join(k.new.code);
        rules.push({ ...base, type: 'regex', kind: k.n, lang, re, repl,
          needLine: t.needLineContext ? new RegExp(t.needLineContext, 'iu') : null, lineExclude: (t.lineExclude || []).map((x) => new RegExp(x, 'u')) });
      }
    }
  }
  return rules;
}

const layerOf = (map, rel) => map.layers.find((l) => new RegExp(l.test).test(rel)) || { id: 'other', mode: 'auto', wave: 'W3' };

function inScope(rule, layerId) {
  if (rule.layers === '*') return true;
  const neg = rule.layers.filter((x) => x.startsWith('!')).map((x) => x.slice(1));
  const pos = rule.layers.filter((x) => !x.startsWith('!'));
  return !neg.includes(layerId) && (pos.length === 0 || pos.includes(layerId));
}

const countMatches = (re, s) => { re.lastIndex = 0; const n = (s.match(re) || []).length; re.lastIndex = 0; return n; };

// ctx: { rel, layerId }. Возвращает { out, counts, confirms }. Число строк не меняется.
function applyText(rules, text, ctx) {
  const counts = {};
  const confirms = [];
  const bump = (id, n) => { if (n) counts[id] = (counts[id] || 0) + n; };
  let out = text;
  for (const r of rules) {
    if (!inScope(r, ctx.layerId) || r.skipFiles.some((re) => re.test(ctx.rel))) continue;
    if (r.type === 'line-array') {
      const re = new RegExp('([`\'"])(' + alt(r.oldCodes) + ')\\1', 'gu');
      out = out.split('\n').map((ln) => {
        if (ln.length > 4000) return ln;
        const distinct = new Set([...ln.matchAll(re)].map((m) => m[2]));
        if (distinct.size < 3) return ln;
        return ln.replace(re, (all, q, c) => { bump(r.id, 1); return q + r.kinds.find((x) => x.old.code === c).new.code + q; });
      }).join('\n');
      continue;
    }
    if (r.needLine) {
      out = out.split('\n').map((ln, i) => {
        if (!r.needLine.test(ln) || r.lineExclude.some((re) => re.test(ln))) return ln;
        const n = countMatches(r.re, ln);
        if (!n) return ln;
        bump(r.id, n);
        if (r.confirm) confirms.push({ rule: r.id, line: i + 1, text: ln.trim().slice(0, 140) });
        return ln.replace(r.re, r.repl);
      }).join('\n');
      continue;
    }
    bump(r.id, countMatches(r.re, out));
    out = out.replace(r.re, r.repl);
  }
  return { out, counts, confirms };
}


// ---- файлы проекта (общее для rename и verify) ----
const path = require('path');
const { execFileSync } = require('child_process');
const TEXT = /.(md|json|cjs|js|mjs|sh|php|txt|ya?ml|html|css|py|toml)$/i;
const NESTED = ['.forma/protocol'];
const git = (cwd, args) => execFileSync('git', args, { cwd, maxBuffer: 1 << 29, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');

function walk(root, dir, out) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const rel = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) walk(root, rel, out); else if (e.isFile()) out.push(rel);
  }
}
function lsFiles(cwd) {
  try { return git(cwd, ['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean); } catch { return null; }
}
function listFiles(root) {
  let files = lsFiles(root);
  if (!files) { files = []; walk(root, '', files); }
  const out = [];
  for (const f of files) {
    const abs = path.join(root, f);
    let st; try { st = fs.statSync(abs); } catch { continue; }
    if (st.isDirectory()) {
      if (fs.existsSync(path.join(abs, '.git'))) for (const s of lsFiles(abs) || []) out.push(f + '/' + s); // гитлинк = вложенный репозиторий
      continue;
    }
    if (st.isFile()) out.push(f);
  }
  return [...new Set(out)];
}

module.exports = { esc, alt, loadMap, compile, layerOf, inScope, applyText, git, listFiles, TEXT, NESTED };
