'use strict';
// The demo-cycle marker (`project/config/DEMO`): has the human been offered a short demonstration cycle.
// One word on one line, kept in the project (not in a cache) so it survives a reinstall:
//   none        never offered (a missing file reads the same)
//   declined    the human said no; never offered again
//   later:<n>   not now; offered again after <n> more session starts
//   done        the demo was run
// Shared by the session hooks (via cli.cjs) and the start report; dependency-free.

const fs = require('node:fs');
const path = require('node:path');

const STATES = ['none', 'declined', 'done'];
const LATER_RE = /^later:([1-9]\d{0,2})$/;

const markerFile = (root) => path.join(root, 'project', 'config', 'DEMO');

/** `{ state, n }`: state is `none|declined|later|done`, `n` only for `later`; an unreadable or unknown value reads as `none`. */
function readDemo(root) {
  let raw = '';
  try { raw = fs.readFileSync(markerFile(root), 'utf8').trim().split(/\r?\n/)[0].trim(); } catch { /* no marker: never offered */ }
  const later = LATER_RE.exec(raw);
  if (later) return { state: 'later', n: +later[1] };
  return { state: STATES.includes(raw) ? raw : 'none', n: 0 };
}

/** Writes the marker; throws on a value outside the closed list. */
function writeDemo(root, value) {
  const v = String(value).trim();
  if (!STATES.includes(v) && !LATER_RE.test(v)) throw new Error(`demo marker: "${v}" — one of none|declined|done|later:<n>`);
  fs.mkdirSync(path.dirname(markerFile(root)), { recursive: true });
  fs.writeFileSync(markerFile(root), v + '\n');
  return v;
}

/** One session start has passed: `later:n` counts down, and at the end offers the demo again (`none`). */
function tickDemo(root) {
  const d = readDemo(root);
  if (d.state !== 'later') return d;
  writeDemo(root, d.n > 1 ? `later:${d.n - 1}` : 'none');
  return readDemo(root);
}

/** The board holds no real card: nothing outside `done/` and nothing outside the demo (label `demo`). */
function boardEmpty(root) {
  const dir = path.join(root, '.devtool', 'features');
  const scan = (d) => {
    let names = [];
    try { names = fs.readdirSync(d, { withFileTypes: true }); } catch { return false; }
    return names.some((e) => {
      if (e.isDirectory()) return scan(path.join(d, e.name));
      if (!/^card-\d+.*\.md$/.test(e.name)) return false;
      const text = fs.readFileSync(path.join(d, e.name), 'utf8');
      return !/^labels:\s*\[[^\]]*"demo"/m.test(text);
    });
  };
  return !scan(dir);
}

module.exports = { readDemo, writeDemo, tickDemo, boardEmpty, markerFile };
