// Схема движка: данные для блок-схемы. Блоки — из манифеста (schema-manifest.cjs), состав — реальные файлы на диске,
// связи (читает, пишет, вызывает, регистрирует, порождает) — из settings.json/hooks.json и текста файлов.
// Ничего не рисуется вручную: что не нашлось в файлах — попадает в gaps, а не выдумывается. Модель не вызывается.
// Описание файла берётся из structure.cjs (describe) — без копии. Формат результата — в конце файла (SCHEMA_SHAPE).
'use strict';

const fs = require('fs');
const path = require('path');
const { describe } = require('./structure.cjs');
const M = require('./schema-manifest.cjs');

const CODE = /\.(cjs|js|mjs|sh|py)$/;
const TEXT = /\.(cjs|js|mjs|sh|py|md|json|toml|html|css|txt|yaml|yml)$/;
const TOKEN = /[A-Za-z0-9_$.{}\-/]*[A-Za-z0-9_\-]\.(?:cjs|js|mjs|sh|py|md|json|toml)\b/g;
const WRITE_FN = /(writeFileSync|appendFileSync|writeFile\b|appendFile\b|mkdirSync|renameSync|copyFileSync|writeJson|>>|\s>\s)/;
const CALL_CTX = /(require\s*\(|\bnode\s|\bbash\s|\bsh\s|spawn|exec|fork\s*\(|import\s*\()/;
const SPAWN_CTX = /(spawn|fork\s*\(|detached)/;
const AGENT_CTX = /(subagent_type|\bAgent\b|spawn|invok|порожд|вызыва)/i;
const NODE_FILE = /^\.claude\/agents\/(run\/)?[^/]+\.md$/;
const MAX_BYTES = 400 * 1024;

const toRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0001').replace(/\*\*/g, '\u0002')
  .replace(/\*/g, '[^/]*').replace(/\u0001/g, '(?:.*/)?').replace(/\u0002/g, '.*') + '$');
const RULE_RES = M.RULES.map((r) => ({ ...r, re: toRe(r.glob) }));
const SKIP_RES = M.SKIP_GLOBS.map(toRe);
const ENTRY_RES = (M.ENTRYPOINTS || []).map((e) => ({ ...e, re: toRe(e.glob) }));

function listFiles(root) {
  const out = new Set();
  const visit = (rel) => {
    const abs = path.join(root, rel);
    let st; try { st = fs.statSync(abs); } catch { return; }
    if (SKIP_RES.some((re) => re.test(rel))) return;
    if (st.isDirectory()) {
      let ents = []; try { ents = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        if (e.isDirectory() && M.SKIP_DIRS.includes(e.name)) continue;
        visit(rel + '/' + e.name);
      }
    } else out.add(rel);
  };
  M.ROOTS.forEach(visit);
  return [...out].sort();
}

function readText(root, rel) {
  if (!TEXT.test(rel)) return '';
  try { const abs = path.join(root, rel); if (fs.statSync(abs).size > MAX_BYTES) return ''; return fs.readFileSync(abs, 'utf8'); } catch { return ''; }
}

function jsonKeys(text) {
  try { const j = JSON.parse(text); const k = Array.isArray(j) ? ['[' + j.length + ' items]'] : Object.keys(j); return k.length ? 'JSON data: ' + k.slice(0, 6).join(', ') : null; } catch { return null; }
}

function createResolver(files) {
  const set = new Set(files);
  const byBase = new Map();
  for (const f of files) { const b = path.posix.basename(f); (byBase.get(b) || byBase.set(b, []).get(b)).push(f); }
  // несколько кандидатов: тот же движок, что у источника; иначе основной (.claude), иначе .forma
  const pick = (c, from) => {
    if (c.length === 1) return c[0];
    const top = (x) => x.split('/')[0];
    for (const pool of [c.filter((x) => top(x) === top(from)), c.filter((x) => x.startsWith('.claude/')), c.filter((x) => x.startsWith('.forma/'))]) {
      if (pool.length === 1) return pool[0];
    }
    return null;
  };
  return function resolve(token, fromFile) {
    let t = token.replace(/^\$\{?\w+\}?\//, '').replace(/^\.\//, '').replace(/[.,;:)]+$/, '');
    if (!t || /[{}$]/.test(t)) return { miss: 'template' };
    if (set.has(t)) return { file: t };
    const rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), t));
    if (set.has(rel)) return { file: rel };
    const base = path.posix.basename(t);
    const cands = byBase.get(base) || [];
    if (t.includes('/')) {
      const hit = cands.filter((c) => c === t || c.endsWith('/' + t));
      if (hit.length) { const h = pick(hit, fromFile); return h ? { file: h } : { miss: 'ambiguous' }; }
      return { miss: 'absent' };
    }
    const near = cands.filter((c) => path.posix.dirname(c) === path.posix.dirname(fromFile));
    const h = near.length === 1 ? near[0] : pick(cands, fromFile);
    if (h) return { file: h };
    return { miss: cands.length ? 'ambiguous' : 'absent' };
  };
}

function areaOf(token) {
  const t = token.replace(/^\.\//, '');
  return M.AREAS.find((a) => t === a.prefix || t.startsWith(a.prefix + '/') || t.startsWith(a.prefix + '.')) || null;
}

function blockOf(rel) {
  const r = RULE_RES.find((x) => x.re.test(rel));
  return r ? { block: r.block, does: r.does || null } : { block: null, does: null };
}

/** Связи settings.json/hooks.json: регистрирует каждый скрипт из команд хуков. */
function registerLinks(rel, text, resolve, out) {
  let j; try { j = JSON.parse(text); } catch { return; }
  const walk = (v, ev) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, ev));
    else if (v && typeof v === 'object') {
      if (typeof v.command === 'string') {
        for (const m of v.command.match(TOKEN) || []) {
          const r = resolve(m, rel);
          if (r.file) out.push({ from: rel, to: r.file, type: 'registers', evidence: (ev || 'hook') + ': ' + v.command.slice(0, 120) });
        }
      }
      for (const [k, x] of Object.entries(v)) walk(x, /^[A-Z]/.test(k) ? k : ev);
    }
  };
  walk(j, '');
}

function textLinks(rel, text, resolve, agentNames, out, unresolved) {
  if (!text) return;
  const isCode = CODE.test(rel), isMd = /\.md$/.test(rel);
  // path.join('a','b') и ['a','b'] -> a/b
  const flat = text.replace(/['"`]\s*,\s*['"`]/g, '/');
  const lines = flat.split(/\r?\n/);
  lines.forEach((line, i) => {
    const near = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
    const writes = isCode && (WRITE_FN.test(line) || WRITE_FN.test(near) && !/read(File|dir)/i.test(line));
    for (const tok of line.match(TOKEN) || []) {
      const r = resolve(tok, rel);
      if (!r.file) {
        if (r.miss === 'absent' && tok.includes('/') && !areaOf(tok)) unresolved.push({ from: rel, token: tok });
        continue;
      }
      if (r.file === rel) continue;
      const toCode = CODE.test(r.file);
      let type = null;
      if (isCode) {
        if (writes && !toCode) type = 'writes';
        else if (SPAWN_CTX.test(line) && toCode && !/require\s*\(/.test(line)) type = 'spawns';
        else if (CALL_CTX.test(line) && toCode) type = 'calls';
        else if (!toCode) type = 'reads';
      } else if (isMd) {
        if (/\b(node|bash|sh)\s+\S*$/.test(line.slice(0, line.indexOf(tok) + tok.length)) && toCode) type = 'calls';
        else if (AGENT_CTX.test(line) && NODE_FILE.test(r.file)) type = 'spawns';
        else type = 'reads';
      } else type = 'reads';
      if (type) out.push({ from: rel, to: r.file, type, evidence: line.trim().slice(0, 140) });
    }
    // области вне состава (.devtool/features, .claude/.ledger, ...)
    for (const a of M.AREAS) {
      if (line.includes(a.prefix)) {
        const type = isCode ? (writes ? 'writes' : 'reads') : 'reads';
        out.push({ from: rel, to: 'area:' + a.prefix, area: a, type, evidence: line.trim().slice(0, 140) });
      }
    }
    // порождение узла по имени: `plumb-haiku`, `run-script` в строке про вызов агента
    if (isMd && AGENT_CTX.test(line)) {
      for (const [name, file] of agentNames) {
        if (file !== rel && new RegExp('`' + name.replace(/[-]/g, '\\-') + '`').test(line)) out.push({ from: rel, to: file, type: 'spawns', evidence: line.trim().slice(0, 140) });
      }
    }
  });
}

function parseEngineMap(root, resolve, files) {
  const result = { tokens: 0, resolved: [], unresolved: [] };
  const seen = new Set();
  for (const lang of ['ru', 'en']) {
    const rel = `.forma/manual/${lang}/03-protocol/ENGINE-MAP.md`;
    const text = readText(root, rel);
    for (const m of text.matchAll(/`([^`\n]+)`/g)) {
      for (const part of m[1].split(/\s+/)) {
        const tok = part.replace(/[,;()]+$/g, '');
        if (!/(\.(cjs|js|mjs|sh|py|md|json|toml)|\/)$/.test(tok) || /[*<>]/.test(tok) || seen.has(lang + tok)) continue;
        seen.add(lang + tok); result.tokens++;
        let hit = null;
        if (tok.endsWith('/')) hit = files.find((f) => f.startsWith(tok) || f.includes('/' + tok)) || (areaOf(tok.slice(0, -1)) && 'area');
        else { const r = resolve(tok, rel); hit = r.file || (areaOf(tok) && 'area'); }
        (hit ? result.resolved : result.unresolved).push({ lang, token: tok, file: hit && hit !== 'area' ? hit : null });
      }
    }
  }
  return result;
}

function buildSchema(root) {
  root = root || path.resolve(__dirname, '..', '..');
  const files = listFiles(root);
  const resolve = createResolver(files);
  const agentNames = files.filter((f) => NODE_FILE.test(f)).map((f) => [path.posix.basename(f, '.md'), f]);
  const raw = [], unresolved = [];
  const texts = {};
  for (const f of files) {
    const t = readText(root, f); texts[f] = t;
    if (/(settings\.json|hooks\.json)$/.test(f)) registerLinks(f, t, resolve, raw);
    textLinks(f, t, resolve, agentNames, raw, unresolved);
  }
  const fileBlock = new Map();
  const items = files.map((f) => {
    const { block, does: ruleDoes } = blockOf(f);
    fileBlock.set(f, block);
    const entry = ENTRY_RES.find((e) => e.re.test(f)) || null;
    let does = null;
    try { does = describe(path.join(root, f)); } catch { /* нет описания */ }
    if (!does && /\.json$/.test(f)) does = jsonKeys(texts[f]);
    return { path: f, block, does: does || ruleDoes, doesSource: does ? 'file' : ruleDoes ? 'manifest' : null,
      kind: CODE.test(f) ? 'script' : /\.md$/.test(f) ? 'doc' : /\.json$/.test(f) ? 'data' : 'other',
      entry: entry ? { ru: entry.ru, en: entry.en } : null };
  });
  // связи: уникальные по (from,to,type)
  const seen = new Map();
  for (const l of raw) {
    const key = l.from + '>' + l.to + '>' + l.type;
    if (seen.has(key)) continue;
    const toBlock = l.area ? l.area.block : fileBlock.get(l.to);
    if (!toBlock || !fileBlock.get(l.from)) continue;
    seen.set(key, { from: l.from, to: l.to, type: l.type, fromBlock: fileBlock.get(l.from), toBlock, evidence: l.evidence });
  }
  const links = [...seen.values()];
  for (const it of items) {
    const callers = links.filter((l) => l.to === it.path && ['calls', 'registers', 'spawns'].includes(l.type)).map((l) => ({ path: l.from, type: l.type }));
    const readBy = links.filter((l) => l.to === it.path && l.type === 'reads').map((l) => l.from);
    it.callers = callers; it.readBy = readBy;
    it.caller = callers.length ? callers[0].path : it.entry ? (it.entry.en) : readBy.length ? readBy[0] : null;
    it.callerKind = callers.length ? 'link' : it.entry ? 'entry' : readBy.length ? 'reader' : 'none';
  }
  const blocks = M.BLOCKS.map((b) => ({ ...b, files: items.filter((i) => i.block === b.key).map((i) => i.path) }));
  const agg = new Map();
  for (const l of links) {
    const k = l.fromBlock + '>' + l.toBlock + '>' + l.type;
    const a = agg.get(k) || { from: l.fromBlock, to: l.toBlock, type: l.type, count: 0 };
    a.count++; agg.set(k, a);
  }
  return {
    linkTypes: M.LINK_TYPES,
    blocks,
    files: items,
    links,
    blockLinks: [...agg.values()],
    unsorted: items.filter((i) => !i.block).map((i) => i.path),
    gaps: {
      noDoes: items.filter((i) => !i.does).map((i) => i.path),
      noCaller: items.filter((i) => i.callerKind === 'none').map((i) => i.path),
      unresolvedRefs: unresolved.slice(0, 300),
      unresolvedRefsTotal: unresolved.length,
    },
    engineMap: parseEngineMap(root, resolve, files),
  };
}

module.exports = { buildSchema, blockOf, listFiles };

if (require.main === module) {
  const s = buildSchema();
  console.log('files', s.files.length, 'links', s.links.length, 'unsorted', s.unsorted.length, 'noDoes', s.gaps.noDoes.length, 'noCaller', s.gaps.noCaller.length);
  for (const b of s.blocks) console.log(b.key, b.files.length);
}

/* SCHEMA_SHAPE
{ linkTypes:[{key,ru,en}], blocks:[{key,ru,en,descRu,descEn,files:[path]}],
  files:[{path,block,does,doesSource,kind,entry,callers:[{path,type}],readBy:[path],caller,callerKind}],
  links:[{from,to,type,fromBlock,toBlock,evidence}]  (to — путь файла или 'area:<prefix>'),
  blockLinks:[{from,to,type,count}], unsorted:[path], gaps:{noDoes,noCaller,unresolvedRefs,unresolvedRefsTotal},
  engineMap:{tokens,resolved:[{lang,token,file}],unresolved:[{lang,token}]} } */
