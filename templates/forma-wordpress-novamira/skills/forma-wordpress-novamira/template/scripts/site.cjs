#!/usr/bin/env node
// node .claude/scripts/site.cjs <novamira arguments>  →  novamira --site <SITE_SLUG from .env> <arguments>
// A pass-through wrapper: the stdio and exit code of novamira are passed on as they are (the run-scripts contract
// applies to work scripts, not to the pass-through). Without SITE_SLUG — code 2, a JSON summary to stderr.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function siteSlug() {
  if (process.env.SITE_SLUG) return process.env.SITE_SLUG.trim();
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return '';
  const m = fs.readFileSync(envFile, 'utf8').match(/^\s*SITE_SLUG\s*=\s*["']?([^"'\r\n]*)/m);
  return m ? m[1].trim() : '';
}

module.exports = { siteSlug };

if (require.main === module) {
  const slug = siteSlug();
  if (!slug) {
    process.stderr.write(JSON.stringify({ status: 'stop', error: 'no SITE_SLUG in .env' }) + '\n');
    process.exit(2);
  }
  const r = spawnSync('novamira', ['--site', slug, ...process.argv.slice(2)],
    { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error) {
    process.stderr.write(JSON.stringify({ status: 'stop', error: r.error.message }) + '\n');
    process.exit(2);
  }
  process.exit(r.status == null ? 2 : r.status);
}
