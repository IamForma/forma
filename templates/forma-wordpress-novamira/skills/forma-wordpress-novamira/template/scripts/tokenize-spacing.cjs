#!/usr/bin/env node
// Replace bare px spacing literals with scale tokens in an HTML file, with a before/after report.
// Touches only: <style> blocks, style="..." attributes, and class="..." attributes (Tailwind `p-[Npx]` etc.).
// <script> content is never touched. Only padding/margin/gap properties (and their side/axis forms);
// 0, vh/vw/em/rem/%, calc()/clamp()/var() contents are left as they are and counted as "kept".
// A px value not on the scale snaps to the nearest step (ties go down).
// Usage: node .claude/scripts/tokenize-spacing.cjs <file> --scale "4=--sp-1,8=--sp-2,..." [--report out.json] [--dry]
// Output: one JSON line {status, replaced, kept, snapped:[{from,to,count}], tailwind_replaced, remaining_px_in_spacing, report}
const fs = require('fs');
const args = process.argv.slice(2);
const file = args[0];
const opt = n => { const i = args.indexOf(n); return i > 0 ? args[i + 1] : null; };
const dry = args.includes('--dry');
const scaleArg = opt('--scale');
const out = (o, c) => { console.log(JSON.stringify(o)); process.exit(c); };
if (!file || !scaleArg) out({ status: 'fail', reason: 'usage: <file> --scale "4=--sp-1,8=--sp-2,..." [--report f] [--dry]' }, 1);
const scale = scaleArg.split(',').map(p => { const [px, name] = p.split('='); return { px: +px, name: name.replace(/^--/, '') }; }).sort((a, b) => a.px - b.px);
const nearest = px => scale.reduce((b, s) => Math.abs(s.px - px) < Math.abs(b.px - px) ? s : b, scale[0]);
const snaps = {}; let replaced = 0, kept = 0, twRep = 0;
const note = (from, s) => { const k = from + '->' + s.px; snaps[k] = (snaps[k] || 0) + 1; replaced++; };
const PROP = /(^|[;{\s])((?:padding|margin)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap)\s*:\s*([^;}"]*)/g;
function value(v) {
  // split off var()/calc()/clamp()/min()/max() groups untouched
  let res = '', i = 0;
  while (i < v.length) {
    const m = /^(?:var|calc|clamp|min|max)\(/.exec(v.slice(i));
    if (m) { let d = 0, j = i; for (; j < v.length; j++) { if (v[j] === '(') d++; else if (v[j] === ')' && --d === 0) { j++; break; } } res += v.slice(i, j); kept++; i = j; continue; }
    const n = /^(-?)(\d+(?:\.\d+)?)px(?![\w%])/.exec(v.slice(i));
    if (n && !/[\w.]/.test(v[i - 1] || ' ')) {
      const px = +n[2];
      if (px === 0) { res += n[0]; i += n[0].length; continue; }
      const s = nearest(px); note(px, s);
      res += n[1] ? `calc(var(--${s.name})*-1)` : `var(--${s.name})`; i += n[0].length; continue;
    }
    res += v[i++];
  }
  return res;
}
const css = c => c.replace(PROP, (a, pre, prop, val) => pre + prop + ':' + value(val.trim()));
let t = fs.readFileSync(file, 'utf8');
const original = t;
const parts = t.split(/(<script\b[\s\S]*?<\/script>)/i);
for (let k = 0; k < parts.length; k++) {
  if (/^<script/i.test(parts[k])) continue;
  parts[k] = parts[k].replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (a, o, c, e) => o + css(c) + e)
    .replace(/(\bstyle=")([^"]*)(")/gi, (a, o, c, e) => o + css(c) + e)
    .replace(/(\bclass=")([^"]*)(")/gi, (a, o, c, e) => o + c.replace(/\b((?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-)\[(\d+(?:\.\d+)?)px\]/g, (x, p, n) => {
      if (+n === 0) return x; const s = nearest(+n); note(+n, s); twRep++; return `${p}[var(--${s.name})]`;
    }) + e);
}
t = parts.join('');
const left = (t.match(/\b(?:padding|margin|gap)[a-z-]*\s*:[^;}"]*\b[1-9]\d*(?:\.\d+)?px/g) || []).length;
const snapped = Object.entries(snaps).map(([k, count]) => { const [from, to] = k.split('->'); return { from: +from, to: +to, count }; }).sort((a, b) => b.count - a.count);
const rep = { status: 'ok', dry, replaced, kept, snapped, tailwind_replaced: twRep, remaining_px_in_spacing: left };
if (!dry) fs.writeFileSync(file, t);
const r = opt('--report'); if (r) fs.writeFileSync(r, JSON.stringify(rep, null, 1));
out({ ...rep, report: r || null }, 0);
