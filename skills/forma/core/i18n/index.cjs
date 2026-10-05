'use strict';
// Machine layer of the protocol's languages. Documents may be written in any language; scripts and hooks
// read them by English keys, never by translated text.
//   - A key is anchored in the document: `**Project language** <!-- k:language -->`, `| Name <!-- k:name --> | … |`.
//     The anchor is invisible when rendered and survives translation of the visible label.
//   - Without an anchor the label is matched against keys.json (en, ru): documents written before anchors existed.
// Used by the dashboard, the installer, the hooks (via cli.cjs) and the board checks. Dependency-free.

const fs = require('node:fs');
const path = require('node:path');

const KEYS = require('./keys.json');

const ANCHOR_RE = /<!--\s*k:([a-z0-9._-]+)\s*-->/;
const COMMENT_RE = /<!--[\s\S]*?-->/g;

const anchor = (key) => `<!-- k:${key} -->`;
const anchorOf = (raw) => (String(raw).match(ANCHOR_RE) || [])[1] || null;
const stripComments = (text) => String(text).replace(COMMENT_RE, '');
/** Visible text of a cell or paragraph: no anchors, emphasis marks, backticks or table pipes at the edges. */
const plain = (raw) => stripComments(raw).replace(/`/g, '').replace(/^[|\s*]+|[|\s]+$/g, '').trim();

const labelsOf = (key) => Object.entries((KEYS.labels[key] || {}))
  .filter(([lang]) => lang !== 'match').flatMap(([, v]) => v);
const phrases = (name) => KEYS.phrases[name] || [];

/** Does `raw` (a table cell or the start of a paragraph) name `key`: by anchor first, else by a known label. */
function isKey(raw, key) {
  const a = anchorOf(raw);
  if (a) return a === key;
  const text = plain(raw).replace(/\*\([^)]*\)\*.*$/, '').replace(/\*+$/, '').trim();
  const exact = (KEYS.labels[key] || {}).match === 'exact';
  return labelsOf(key).some((l) => (exact ? text === l : text.startsWith(l)));
}

/** Language name or code → code (`en`, `ru`, …). Unknown language — `null`: no catalog, English is used. */
function langCode(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  for (const [code, names] of Object.entries(KEYS.languages)) if (v === code || names.includes(v)) return code;
  return /^[a-z]{2,3}$/.test(v) ? v : null;
}

const tableCells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => plain(c));

/** Reader of the sections of PROJECT.md (a section is a paragraph that starts with **Label**; its table is the next one). */
function reader(raw) {
  const lines = String(raw || '').split(/\r?\n/);
  const secStart = (key) => lines.findIndex((l) => l.startsWith('**') && isKey(l.replace(/^\*\*/, ''), key));
  const inline = (key) => {
    const l = lines[secStart(key)];
    if (!l) return null;
    const m = stripComments(l).replace(/\*\([^)]*\)\*/g, '').match(/:\s*(.+)$/);
    return m ? plain(m[1].replace(/\.\s.*$/, '').replace(/\.$/, '')) : null;
  };
  const table = (key) => {
    const i = secStart(key);
    if (i < 0) return null;
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('|')) {
      if (lines[j].startsWith('**') || lines[j].startsWith('---')) return { columns: [], rows: [] };
      j++;
    }
    const columns = j < lines.length ? tableCells(lines[j]) : [];
    const rows = [];
    for (let k = j + 2; k < lines.length && lines[k].startsWith('|'); k++) {
      const r = tableCells(lines[k]);
      r.key = anchorOf(lines[k].split('|')[1] || '');
      r.firstRaw = lines[k].split('|')[1] || '';
      if (r.some((c) => c)) rows.push(r);
    }
    return { columns, rows };
  };
  const trailingNumber = (key) => {
    const l = lines[secStart(key)];
    const m = l && stripComments(l).match(/:\s*(\d+)\s*$/);
    return m ? m[1] : null;
  };
  return { inline, table, trailingNumber };
}

/** Second column of the table row that names `key` (by anchor, else by label); no table or row — `null`. */
function rowValue(table, key) {
  const r = table && table.rows.find((x) => isKey(x.firstRaw !== undefined ? x.firstRaw : x[0], key));
  return r ? r[1] : null;
}

/** Rewrites the second cell of the first table row that names `key`; returns the new text, or the same text when no row matches. */
function setRow(raw, key, value) {
  const lines = String(raw).split('\n');
  const i = lines.findIndex((l) => l.startsWith('|') && isKey(l.split('|')[1] || '', key));
  if (i < 0) return raw;
  const cells = lines[i].split('|');
  cells[2] = ` ${value} `;
  lines[i] = cells.join('|');
  return lines.join('\n');
}

// Which row keys live in which section's table: anchors are added only where a parser reads them.
const SECTION_ROWS = { template: ['name', 'source', 'status'], thresholds: ['attempts', 'volume'] };
const SECTIONS = ['language', 'template', 'thresholds', 'epics', 'services', 'tooling', 'references', 'release'];

/** Adds the missing anchors to a document written without them (labels known to keys.json); idempotent. */
function anchorise(raw) {
  let section = null;
  return String(raw).split('\n').map((line) => {
    if (line.startsWith('**')) {
      section = SECTIONS.find((k) => isKey(line.replace(/^\*\*/, ''), k)) || null;
      if (!section || anchorOf(line)) return line;
      return line.replace(/^(\*\*[^*]+\*\*)/, `$1 ${anchor(section)}`);
    }
    if (section && line.startsWith('|') && SECTION_ROWS[section]) {
      const parts = line.split('|');
      if (anchorOf(parts[1] || '')) return line;
      const key = SECTION_ROWS[section].find((k) => isKey(parts[1] || '', k));
      if (!key) return line;
      parts[1] = `${(parts[1] || '').replace(/\s*$/, '')} ${anchor(key)} `;
      return parts.join('|');
    }
    return line;
  }).join('\n');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Heading line `## …` of a card zone (`zone.task`, `zone.history`, …): by anchor when it carries one, else by a known label.
 * A regex over the whole line, without the line break; `flags` default to `m`.
 */
function headingRe(key, flags = 'm') {
  const labels = labelsOf(key).map(escapeRe).join('|');
  const a = `<!--\\s*k:${escapeRe(key)}\\s*-->`;
  return new RegExp(`^##[ \\t]+(?:(?:${labels})[ \\t]*(?:${a})?|[^\\n]*?${a})[ \\t]*\\r?$`, flags);
}

/** PROJECT.md of a project: in the root of a working project or under project/config/ in the protocol repository. */
function projectMdPath(root) {
  for (const rel of ['project/config/PROJECT.md', 'PROJECT.md', 'project/PROJECT.md']) {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const readProjectMd = (root) => { const p = projectMdPath(root); return p ? fs.readFileSync(p, 'utf8') : ''; };

/** Language code of the project documents: `FORMA_LANG` overrides; no field or an unknown language — `en`. */
function projectLang(root) {
  if (process.env.FORMA_LANG) return langCode(process.env.FORMA_LANG) || 'en';
  const word = (reader(readProjectMd(root)).inline('language') || '').split(/\s+/)[0];
  return langCode(word) || 'en';
}

/** Message by code in `lang` with `{name}` placeholders; no catalog or no code in it — English, then the code itself. */
function message(code, params, lang) {
  const load = (l) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'messages', l + '.json'), 'utf8')); } catch { return {}; } };
  const text = (load(lang || 'en')[code]) ?? load('en')[code] ?? code;
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] !== undefined ? params[k] : m));
}

module.exports = {
  KEYS, anchor, anchorOf, stripComments, plain, labelsOf, phrases, isKey, langCode,
  reader, rowValue, setRow, anchorise, headingRe, projectMdPath, readProjectMd, projectLang, message,
};
