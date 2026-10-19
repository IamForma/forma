#!/usr/bin/env node
// Screenshot a local page with headless Chrome at several widths and save the console log.
// Usage: node .claude/scripts/shot-page.cjs <html-file> <out-dir> <label> [--widths 1440,390] [--wait 4000]
// Writes <out-dir>/<label>-<width>.png and <label>-<width>-console.txt (error/warning lines only).
// Output: one JSON line {status, shots:[{width,png,console_errors}]}. Viewport capture (no scroll);
// needs Chrome at the standard install path or CHROME_PATH.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const a = process.argv.slice(2);
const [file, dir, label] = a;
const opt = (n, d) => { const i = a.indexOf(n); return i > 0 ? a[i + 1] : d; };
const out = (o, c) => { console.log(JSON.stringify(o)); process.exit(c); };
if (!file || !dir || !label) out({ status: 'fail', reason: 'usage: <html-file> <out-dir> <label> [--widths 1440,390] [--wait ms]' }, 1);
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(Boolean).find(p => fs.existsSync(p));
if (!chrome) out({ status: 'fail', reason: 'chrome not found, set CHROME_PATH' }, 1);
if (!fs.existsSync(file)) out({ status: 'fail', reason: 'page missing' }, 1);
fs.mkdirSync(dir, { recursive: true });
const url = require('url').pathToFileURL(path.resolve(file)).href;
const shots = [];
for (const w of opt('--widths', '1440,390').split(',').map(Number)) {
  const h = w >= 768 ? 900 : 844, png = path.resolve(dir, `${label}-${w}.png`);
  const prof = fs.mkdtempSync(path.join(require('os').tmpdir(), 'shot-'));
  const r = cp.spawnSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${prof}`, `--window-size=${w},${h}`,
    `--virtual-time-budget=${opt('--wait', '4000')}`, '--enable-logging=stderr', '--v=0', `--screenshot=${png}`, url], { encoding: 'utf8', timeout: 90000 });
  const lines = ((r.stderr || '') + (r.stdout || '')).split(/\r?\n/).filter(l => /CONSOLE/.test(l) && /(ERROR|WARNING|Uncaught|Failed|net::)/i.test(l));
  fs.writeFileSync(path.resolve(dir, `${label}-${w}-console.txt`), lines.join('\n') + '\n');
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  shots.push({ width: w, png: fs.existsSync(png) ? png : null, console_errors: lines.length });
}
out({ status: shots.every(s => s.png) ? 'ok' : 'fail', shots }, shots.every(s => s.png) ? 0 : 1);
