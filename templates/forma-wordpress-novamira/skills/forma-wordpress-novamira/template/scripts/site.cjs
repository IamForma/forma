#!/usr/bin/env node
// node .claude/scripts/site.cjs <аргументы novamira>  →  novamira --site <SITE_SLUG из .env> <аргументы>
// Обёртка-проводник: stdio и код выхода novamira пробрасываются как есть (договор run-scripts
// относится к скриптам работы, не к проводнику). Без SITE_SLUG — код 2, сводка JSON в stderr.
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
    process.stderr.write(JSON.stringify({ status: 'stop', error: 'нет SITE_SLUG в .env' }) + '\n');
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
