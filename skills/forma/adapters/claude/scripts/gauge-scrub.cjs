#!/usr/bin/env node
'use strict';
// Scrubs a card's task for the Gauge's external executor (AGENTS.md prohibition 17).
// Not a model; fail-closed. Usage:
//   node .claude/scripts/gauge-scrub.cjs <card.md> [--root DIR] [--site host[,host]] [--out FILE]
// Output (stdout or --out): JSON {task, report}. The report holds counts only, never values.
// Exit: 0 scrubbed, 2 refused (residue looks like a secret), 1 usage/read error.

const fs = require('fs');
const path = require('path');

const MIN_SECRET_LEN = 4;
const TRIVIAL = new Set(['true', 'false', 'null', 'none', 'yes', 'no', 'on', 'off']);

function parseArgs(argv) {
  const a = { card: null, root: process.cwd(), site: [], out: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--root') a.root = path.resolve(argv[++i]);
    else if (v === '--site') a.site.push(...argv[++i].split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
    else if (v === '--out') a.out = argv[++i];
    else if (!a.card) a.card = v;
  }
  return a;
}

// Whitelist: only the text of the `## Task` zone (five fields); nothing else of the card.
function extractTask(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const start = lines.findIndex(l => /^##\s+(Задача|Task)\s*$/.test(l));
  if (start < 0) return null;
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join('\n').trim();
}

function addSecret(map, name, value) {
  value = String(value).trim().replace(/^["'`]|["'`]$/g, '');
  if (value.length < MIN_SECRET_LEN || TRIVIAL.has(value.toLowerCase())) return;
  if (!map.has(value)) map.set(value, name);
}

function hostOf(url) {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/\s:?#]+)/i.exec(url);
  return m ? m[1].toLowerCase() : null;
}

// Values from .env and VARS/ -> [[name]]; hosts of URL values -> site hosts.
function loadSecrets(root, siteHosts) {
  const secrets = new Map();
  const envFile = path.join(root, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!m) continue;
      addSecret(secrets, m[1], m[2]);
      const h = hostOf(m[2].replace(/^["']|["']$/g, ''));
      if (h) siteHosts.add(h);
    }
  }
  const varsDir = path.join(root, 'VARS');
  if (fs.existsSync(varsDir)) {
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    for (const f of walk(varsDir)) {
      const base = path.basename(f).replace(/\.[^.]+$/, '');
      for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
        let m = /^\s*[-*]?\s*`?([\w.-]+)`?\s*[:=]\s*(.+?)\s*$/.exec(line);          // name: value | name = value
        if (!m) m = /^\s*\|\s*`?\[?\[?([\w.-]+)\]?\]?`?\s*\|\s*(.+?)\s*\|?\s*$/.exec(line); // | name | value |
        if (!m || /^[-: ]+$/.test(m[2])) continue;
        addSecret(secrets, `${base}.${m[1]}`, m[2]);
        const h = hostOf(m[2]);
        if (h) siteHosts.add(h);
      }
    }
  }
  return secrets;
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function scrub(task, secrets, siteHosts) {
  const counts = {};
  const bump = k => { counts[k] = (counts[k] || 0) + 1; };
  let t = task;

  // 1. exact secret values, longest first
  const entries = [...secrets.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [value, name] of entries) {
    const re = new RegExp(esc(value), 'g');
    t = t.replace(re, () => { bump('vars'); return `[[${name}]]`; });
  }
  // 2. URLs and site hosts
  t = t.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s)>\]"'`]+/gi, u => {
    const h = hostOf(u);
    bump(h && siteHosts.has(h) ? 'site' : 'url');
    return h && siteHosts.has(h) ? '[site]' : '[url]';
  });
  for (const h of siteHosts) {
    t = t.replace(new RegExp(`\\b${esc(h)}\\b`, 'gi'), () => { bump('site'); return '[site]'; });
  }
  // 3. patterns
  t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, () => { bump('email'); return '[email]'; });
  t = t.replace(/\b(?:sk|pk|ghp|gho|xox[abp]|AKIA)[-_]?[A-Za-z0-9_-]{16,}\b/g, () => { bump('token'); return '[token]'; });
  t = t.replace(/\b[A-Za-z0-9]{32,}\b/g, () => { bump('token'); return '[token]'; });
  t = t.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, () => { bump('ip'); return '[ip]'; });
  t = t.replace(/\+?\d[\d\s().-]{8,}\d/g, m => {
    if (m.replace(/\D/g, '').length < 10) return m;
    bump('phone'); return '[phone]';
  });
  t = t.replace(/\b[A-Za-z]:[\\/][^\s,;)"'`]+/g, () => { bump('path'); return '[path]'; });
  t = t.replace(/(?<![\w.])\/(?:home|Users|var|etc|root|opt|srv|mnt)\/[^\s,;)"'`]+/g, () => { bump('path'); return '[path]'; });
  return { text: t, counts };
}

// Fail-closed residue check: returns a list of reasons (no values).
function residue(text, secrets) {
  const why = [];
  for (const value of secrets.keys()) if (text.includes(value)) { why.push('secret value remains'); break; }
  if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(text)) why.push('e-mail remains');
  if (/\b(?:password|passwd|pwd|token|secret|api[_-]?key|пароль|ключ)\b\s*[:=]\s*[^\s\[]/i.test(text)) why.push('credential assignment remains');
  for (const m of text.matchAll(/\b[A-Za-z0-9]{24,}\b/g)) {
    if (/\d/.test(m[0]) && /[A-Za-z]/.test(m[0])) { why.push('long token-like string remains'); break; }
  }
  return why;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.card) { console.error('usage: gauge-scrub.cjs <card.md> [--root DIR] [--site host] [--out FILE]'); process.exit(1); }
  let md;
  try { md = fs.readFileSync(a.card, 'utf8'); } catch (e) { console.error(`cannot read card: ${e.code || e.message}`); process.exit(1); }
  const task = extractTask(md);
  if (!task) { console.error('refused: card has no ## Task / ## Задача zone'); process.exit(2); }

  const siteHosts = new Set(a.site);
  const secrets = loadSecrets(a.root, siteHosts);
  const { text, counts } = scrub(task, secrets, siteHosts);
  const why = residue(text, secrets);
  const result = { ok: why.length === 0, task: why.length ? null : text, report: { replaced: counts, refused: why } };
  const json = JSON.stringify(result, null, 2);
  if (a.out) fs.writeFileSync(a.out, json); else console.log(json);
  process.exit(why.length ? 2 : 0);
}

if (require.main === module) main();
module.exports = { extractTask, loadSecrets, scrub, residue };
