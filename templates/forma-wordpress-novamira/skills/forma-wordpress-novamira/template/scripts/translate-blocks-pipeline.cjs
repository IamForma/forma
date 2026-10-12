#!/usr/bin/env node
'use strict';
/*
 * Конвейер перевода текстовых узлов блоков Gutenberg: пачка -> перевод -> подстановка.
 *
 *   extract --in <html> --work <dir> --glossary <md>
 *     пишет в <dir>: source.html (копия входа), skel.html (текст заменён маркерами ⟦T001⟧),
 *     src.json ([{id, text, protect:[{term, keep}]}]), log.jsonl (строки stage "sent").
 *
 *   apply --work <dir> [--tr <json>]
 *     читает: source.html, skel.html, src.json, tr.json ([{id, text}]) — по умолчанию <dir>/tr.json.
 *     Атрибуты alt, title, aria-label — отдельные строки (поле attr в src.json); в теге переводятся только их значения.
 *     сверяет: ids и порядок, число строк, защищённые термины, побайтно комментарии и теги,
 *     структуру токенов. Пишет out.html только при exit 0. Дописывает в log.jsonl строки stage "received"
 *     (исходная и подставленная строка, флаг кириллицы). Всегда пишет report.json.
 *
 * stdout: только summary-JSON {ok, exit, counts:{blocks, lines_before, lines_after}, path}; path — report.json.
 * exit: 0 — успех; 1 — сверка не совпала; 2 — стоп (вход не читается, контракт нарушен, исключение).
 * Внешние модели и API не вызываются.
 */

const fs = require('fs');
const path = require('path');

const OK = 0;
const MISMATCH = 1;
const STOP = 2;

const OPEN = '⟦';
const CLOSE = '⟧';
const markerOf = (id) => OPEN + id + CLOSE;
const MARKER_RE = /⟦(T\d{3,})⟧/g;

class Stop extends Error {}
const stop = (msg) => { throw new Stop(msg); };

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) stop(`unexpected argument: ${a}`);
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) stop(`missing value for ${a}`);
    args[a.slice(2)] = val;
    i++;
  }
  return args;
}

function need(args, key) {
  if (!args[key]) stop(`missing --${key}`);
  return args[key];
}

function readText(file, label) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    stop(`${label} not readable: ${file}`);
  }
}

function readJson(file, label) {
  const text = readText(file, label);
  try {
    return JSON.parse(text);
  } catch (e) {
    stop(`${label} is not valid JSON: ${file}`);
  }
}

// Токены: комментарии <!-- -->, теги <...>, между ними — текст.
function tokenize(html) {
  const re = /<!--[\s\S]*?-->|<[^>]*>/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) out.push({ kind: 'text', value: html.slice(last, m.index) });
    out.push({ kind: m[0].startsWith('<!--') ? 'comment' : 'tag', value: m[0] });
    last = re.lastIndex;
  }
  if (last < html.length) out.push({ kind: 'text', value: html.slice(last) });
  return out;
}

function splitWs(s) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  return { lead: m[1], core: m[2], trail: m[3] };
}

// Атрибуты с человекочитаемым текстом: alt, title, aria-label, placeholder, value, content, data-*-label
// (data-label и т.п.; только после пробела — не часть другого атрибута).
const ATTR_RE = /(\s)(alt|title|aria-label|placeholder|value|content|data-[\w-]*label)(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;
// Для сверки тегов: значения этих атрибутов не сравниваются (они переведены), всё остальное — побайтно.
const maskAttrs = (tag) => tag.replace(ATTR_RE, (m, sp, name, eq) => `${sp}${name}${eq}""`);

// JSON-атрибуты блоков Gutenberg внутри комментариев <!-- wp:... {...} /-->: только человекочитаемые ключи.
const BLOCK_JSON_KEYS = ['label', 'placeholder', 'buttonText', 'eyebrow', 'lead', 'note', 'suffix', 'prefix'];
const BLOCK_JSON_RE = new RegExp('"(' + BLOCK_JSON_KEYS.join('|') + ')":"((?:[^"\\\\]|\\\\.)*)"', 'g');
const isWpComment = (c) => /^<!--\s*wp:/.test(c);
// Для сверки комментариев: значения этих ключей не сравниваются (они переведены), всё остальное — побайтно.
const maskComment = (c) => (isWpComment(c) ? c.replace(BLOCK_JSON_RE, (m, key) => `"${key}":""`) : c);

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRe = (t) => new RegExp(`(?<![\\p{L}\\p{N}])${escRe(t)}(?![\\p{L}\\p{N}])`, 'iu');
const hasCyrillic = (s) => /\p{Script=Cyrillic}/u.test(s);

// Формы для поиска: полное название и название без скобок ("Forma (протокол)" -> "Forma").
function matchForms(src) {
  const forms = [src];
  const m = /^(.*?)\s*\(.*\)$/u.exec(src);
  if (m && m[1].trim()) forms.push(m[1].trim());
  return forms;
}

// Глоссарий: первая колонка таблицы — «Источник»; колонка «Перевод» — если заполнена, это форма, которую надо сохранить.
function loadGlossary(file) {
  const text = readText(file, 'glossary');
  const terms = [];
  let header = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('|')) { header = null; continue; }
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
    if (!header) { header = cells; continue; }
    const src = cells[0].replace(/^\(служебная\)\s*/u, '').trim();
    if (!src) continue;
    const ti = header.indexOf('Перевод');
    const tr = ti >= 0 ? (cells[ti] || '').trim() : '';
    terms.push({ src, keep: tr || src });
  }
  if (!terms.length) stop('glossary has no terms');
  return terms;
}

function protectedIn(text, terms) {
  const found = [];
  for (const t of terms) {
    if (matchForms(t.src).some((f) => termRe(f).test(text))) {
      found.push({ term: t.src, keep: t.keep });
    }
  }
  return found;
}

// Значения alt/title/aria-label в теге -> отдельные строки Txxx; кавычки и имя атрибута остаются.
function markAttrs(tag, items, terms) {
  return tag.replace(ATTR_RE, (m, sp, name, eq, dq, sq) => {
    const q = dq !== undefined ? '"' : "'";
    const { lead, core, trail } = splitWs(dq !== undefined ? dq : sq);
    if (!core) return m;
    const id = 'T' + String(items.length + 1).padStart(3, '0');
    items.push({ id, text: core, attr: name, protect: protectedIn(core, terms) });
    return `${sp}${name}${eq}${q}${lead}${markerOf(id)}${trail}${q}`;
  });
}

// Значения разрешённых ключей в JSON-атрибутах блока (внутри комментария <!-- wp:... -->), только если есть кириллица.
function markBlockJson(comment, items, terms) {
  if (!isWpComment(comment)) return comment;
  return comment.replace(BLOCK_JSON_RE, (m, key, raw) => {
    let decoded;
    try { decoded = JSON.parse('"' + raw + '"'); } catch (e) { return m; }
    if (!hasCyrillic(decoded)) return m;
    const { lead, core, trail } = splitWs(decoded);
    if (!core) return m;
    const id = 'T' + String(items.length + 1).padStart(3, '0');
    items.push({ id, text: core, attr: 'json:' + key, protect: protectedIn(core, terms) });
    const esc = (s) => JSON.stringify(s).slice(1, -1);
    return `"${key}":"${esc(lead)}${markerOf(id)}${esc(trail)}"`;
  });
}

function extract(args) {
  const inFile = need(args, 'in');
  const work = need(args, 'work');
  const glossary = need(args, 'glossary');
  const html = readText(inFile, 'input');
  if (html.includes(OPEN) || html.includes(CLOSE)) stop('source contains marker characters');
  const terms = loadGlossary(glossary);
  fs.mkdirSync(work, { recursive: true });

  const tokens = tokenize(html);
  const items = [];
  const parts = [];
  for (const tok of tokens) {
    if (tok.kind === 'tag') { parts.push(markAttrs(tok.value, items, terms)); continue; }
    if (tok.kind === 'comment') { parts.push(markBlockJson(tok.value, items, terms)); continue; }
    if (tok.kind !== 'text') { parts.push(tok.value); continue; }
    const { lead, core, trail } = splitWs(tok.value);
    if (!core) { parts.push(tok.value); continue; }
    const id = 'T' + String(items.length + 1).padStart(3, '0');
    items.push({ id, text: core, protect: protectedIn(core, terms) });
    parts.push(lead + markerOf(id) + trail);
  }
  const blocks = tokens.filter((t) => t.kind === 'comment' && /^<!--\s*wp:/.test(t.value)).length;

  fs.writeFileSync(path.join(work, 'source.html'), html, 'utf8');
  fs.writeFileSync(path.join(work, 'skel.html'), parts.join(''), 'utf8');
  fs.writeFileSync(path.join(work, 'src.json'), JSON.stringify(items, null, 2) + '\n', 'utf8');
  const sent = items.map((it) => JSON.stringify({ stage: 'sent', id: it.id, text: it.text, protect: it.protect.map((p) => p.term) }));
  fs.writeFileSync(path.join(work, 'log.jsonl'), sent.join('\n') + '\n', 'utf8');

  return {
    exit: OK,
    counts: { blocks, lines_before: items.length, lines_after: null },
    report: {
      mode: 'extract',
      exit: OK,
      counts: { blocks, lines_before: items.length, lines_after: null },
      glossary_terms: terms.length,
      protected_items: items.filter((it) => it.protect.length).length,
      html_lines: html.split('\n').length,
    },
  };
}

function apply(args) {
  const work = need(args, 'work');
  const trFile = args.tr || path.join(work, 'tr.json');
  const source = readText(path.join(work, 'source.html'), 'source.html');
  const skel = readText(path.join(work, 'skel.html'), 'skel.html');
  const src = readJson(path.join(work, 'src.json'), 'src.json');
  const tr = readJson(trFile, 'tr.json');

  if (!Array.isArray(src)) stop('src.json is not an array');
  const markerIds = [...skel.matchAll(MARKER_RE)].map((m) => m[1]);
  const srcIds = src.map((s) => s.id);
  if (markerIds.length !== src.length || new Set(markerIds).size !== src.length
      || markerIds.some((id, i) => id !== srcIds[i])) {
    stop('skel.html markers do not match src.json');
  }

  const problems = [];
  const trMap = new Map();
  let lines_after = 0;
  if (!Array.isArray(tr)) {
    problems.push('tr.json is not an array');
  } else {
    lines_after = tr.length;
    tr.forEach((it, i) => {
      if (!it || typeof it.id !== 'string' || typeof it.text !== 'string') {
        problems.push(`item ${i}: bad shape (need {id:string, text:string})`);
        return;
      }
      if (trMap.has(it.id)) problems.push(`duplicate id ${it.id}`);
      trMap.set(it.id, it.text);
    });
    const trIds = tr.map((t) => t && t.id);
    if (JSON.stringify(srcIds) !== JSON.stringify(trIds)) {
      problems.push(`ids or order differ: src ${src.length}, tr ${tr.length}`);
    }
  }

  const received = [];
  const applied = new Map();
  for (const s of src) {
    const t = trMap.get(s.id);
    if (t === undefined) { problems.push(`${s.id}: missing in tr.json`); continue; }
    if (t.includes(OPEN) || t.includes(CLOSE)) problems.push(`${s.id}: marker characters in translation`);
    if (s.text.trim() && !t.trim()) problems.push(`${s.id}: empty translation`);
    const isJsonAttr = s.attr && s.attr.startsWith('json:');
    if (s.attr && !isJsonAttr && /["'<>]/.test(t)) problems.push(`${s.id}: quote or angle bracket in ${s.attr} value`);
    for (const p of s.protect || []) {
      if (termRe(p.keep).test(t)) continue;
      // Вложенный protect-термин: p.term целиком входит в более специфичный термин q той же
      // строки, и перевод использует именно q.keep — общий термин поглощён специфичным оборотом.
      const subsumed = (s.protect || []).some((q) => q !== p && q.term !== p.term
        && termRe(p.term).test(q.term) && termRe(q.keep).test(t));
      if (!subsumed) problems.push(`${s.id}: protected term missing: "${p.keep}"`);
    }
    applied.set(s.id, isJsonAttr ? JSON.stringify(t.trim()).slice(1, -1) : t.trim());
    received.push({ stage: 'received', id: s.id, source: s.text, applied: t.trim(), cyrillic: hasCyrillic(t) });
  }

  const out = skel.replace(MARKER_RE, (m, id) => (applied.has(id) ? applied.get(id) : m));

  const srcTok = tokenize(source);
  const outTok = tokenize(out);
  let commentsEqual = true;
  let tagsEqual = true;
  let structureEqual = srcTok.length === outTok.length;
  if (structureEqual) {
    srcTok.forEach((o, i) => {
      const g = outTok[i];
      if (o.kind !== g.kind) { structureEqual = false; return; }
      if (o.kind === 'comment' && maskComment(o.value) !== maskComment(g.value)) commentsEqual = false;
      if (o.kind === 'tag' && maskAttrs(o.value) !== maskAttrs(g.value)) tagsEqual = false;
      if (o.kind === 'text') {
        const a = splitWs(o.value);
        const b = splitWs(g.value);
        if (a.lead !== b.lead || a.trail !== b.trail) structureEqual = false;
      }
    });
  } else {
    structureEqual = false;
  }
  if (!commentsEqual) problems.push('block comments differ from source');
  if (!tagsEqual) problems.push('tags or attributes differ from source');
  if (!structureEqual) problems.push('token structure differs from source');

  const blocks = srcTok.filter((t) => t.kind === 'comment' && /^<!--\s*wp:/.test(t.value)).length;
  const counts = { blocks, lines_before: src.length, lines_after };
  const exit = problems.length ? MISMATCH : OK;

  const logFile = path.join(work, 'log.jsonl');
  const prevLog = fs.existsSync(logFile)
    ? readText(logFile, 'log.jsonl').split('\n').filter((l) => l.trim() && !l.includes('"stage":"received"'))
    : [];
  fs.writeFileSync(logFile, [...prevLog, ...received.map((r) => JSON.stringify(r))].join('\n') + '\n', 'utf8');

  if (exit === OK) fs.writeFileSync(path.join(work, 'out.html'), out, 'utf8');

  return {
    exit,
    counts,
    out,
    report: {
      mode: 'apply',
      exit,
      counts,
      problems,
      checks: {
        ids_match: !problems.some((p) => p.startsWith('ids or order') || p.includes('missing in tr')),
        comments_equal: commentsEqual,
        tags_equal: tagsEqual,
        structure_equal: structureEqual,
        protect_ok: !problems.some((p) => p.includes('protected term missing')),
      },
      cyrillic_items: received.filter((r) => r.cyrillic).map((r) => r.id),
      html_lines: { source: source.split('\n').length, out: out.split('\n').length },
      out_written: exit === OK,
    },
  };
}

function main(argv) {
  const [mode, ...rest] = argv;
  let args = {};
  let result;
  try {
    args = parseArgs(rest);
    if (mode === 'extract') result = extract(args);
    else if (mode === 'apply') result = apply(args);
    else stop('usage: extract --in <html> --work <dir> --glossary <md> | apply --work <dir> [--tr <json>]');
  } catch (e) {
    const msg = e instanceof Stop ? e.message : `unexpected: ${(e && e.stack) || e}`;
    result = {
      exit: STOP,
      counts: { blocks: null, lines_before: null, lines_after: null },
      report: { mode: mode || null, exit: STOP, error: msg },
    };
  }

  let reportPath = null;
  if (args.work) {
    reportPath = path.join(args.work, 'report.json');
    try {
      fs.mkdirSync(args.work, { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(result.report, null, 2) + '\n', 'utf8');
    } catch (e) {
      result = { exit: STOP, counts: result.counts, report: { ...result.report, report_write_error: String(e) } };
    }
  }

  process.stdout.write(JSON.stringify({
    ok: result.exit === OK,
    exit: result.exit,
    counts: result.counts,
    path: reportPath,
  }) + '\n');
  process.exitCode = result.exit;
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { extract, apply };
