#!/usr/bin/env node
// report-extract.cjs — pulls a string field out of a site-php.cjs report's return_value into a local file (backup, mirror).
// node .claude/scripts/report-extract.cjs --report <report.json> --field <field> --out <file inside project/> [--dry-run]
// The file is written byte for byte (UTF-8, no BOM, line endings untouched). Outside project/ — refused (code 2).
// Console: one JSON line {status, bytes, md5, out}. Codes: 0 ok · 2 stop.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const stop = (error) => { console.log(JSON.stringify({ status: 'stop', error })); process.exit(2); };
const report = opt('--report'), field = opt('--field'), out = opt('--out');
if (!report || !field || !out) stop('--report, --field and --out are required');
const dry = argv.includes('--dry-run');
const root = path.resolve('project') + path.sep;
const dest = path.resolve(out);
if (!dest.startsWith(root)) stop('--out only inside project/');
let rep;
try { rep = JSON.parse(fs.readFileSync(report, 'utf8')); } catch (e) { stop('report unreadable: ' + e.message); }
const rv = rep && rep.cli && rep.cli.data && rep.cli.data.return_value;
if (!rv || typeof rv[field] !== 'string' || rv[field] === '') stop('no string "' + field + '" in return_value');
const buf = Buffer.from(rv[field], 'utf8');
const md5 = crypto.createHash('md5').update(buf).digest('hex');
if (!dry) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, buf); }
console.log(JSON.stringify({ status: 'ok', bytes: buf.length, md5, out, dry_run: dry }));
