'use strict';

/**
 * Установка пакета плагина движка в профиль рантайма и проверка паритета.
 *
 * Пакет живёт в двух местах по разным причинам:
 *   — в проекте (`miniapps/minimax-engine/`) как исходник: он под git, его видно в диффе,
 *     его правит генератор `.minimax/scripts/gen-plugin-agents.cjs`;
 *   — в профиле (`<профиль>/plugins/minimax-engine/`) как установленный: только там рантайм
 *     его находит. Профиль — машинный путь, поэтому он не пишется в файлы проекта.
 *
 * Установка копирует файлы поштучно и убирает из цели то, чего больше нет в исходнике, —
 * иначе прошлый пакет навсегда остался бы в профиле.
 *
 * Запуск:
 *   node .minimax/scripts/install-plugin.cjs           — установить
 *   node .minimax/scripts/install-plugin.cjs --check   — только сверить (код 1 при расхождении)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'miniapps', 'minimax-engine');
const PLUGIN_ID = 'minimax-engine';

/** Профиль рантайма: активный каталог данных, а не догадка о домашней папке. */
function profileDir() {
  return process.env.MINIMAX_DATA_DIR || path.join(os.homedir(), '.minimax');
}

function targetDir() {
  return path.join(profileDir(), 'plugins', PLUGIN_ID);
}

/** Все файлы пакета — относительные пути через `/`. */
function listFiles(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + entry.name : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

function readIfExists(p) {
  try {
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  } catch {
    return null;
  }
}

/** Расхождения: файлы, которых нет, и файлы, содержимое которых разошлось. */
function diff(src, dst) {
  const srcFiles = listFiles(src);
  const dstFiles = fs.existsSync(dst) ? listFiles(dst) : [];
  const missing = srcFiles.filter((f) => !dstFiles.includes(f));
  const changed = srcFiles.filter(
    (f) => dstFiles.includes(f) && !readIfExists(path.join(src, f)).equals(readIfExists(path.join(dst, f)))
  );
  const extra = dstFiles.filter((f) => !srcFiles.includes(f));
  return { missing, changed, extra, total: srcFiles.length };
}

function install(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  const files = listFiles(src);
  for (const rel of files) {
    const to = path.join(dst, ...rel.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, ...rel.split('/')), to);
  }
  // Убрать то, чего больше нет в исходнике: старый пакет не должен жить вечно.
  const keep = new Set(files);
  for (const rel of listFiles(dst)) {
    if (!keep.has(rel)) fs.unlinkSync(path.join(dst, ...rel.split('/')));
  }
  return files.length;
}

function main() {
  const check = process.argv.includes('--check');
  if (!fs.existsSync(SRC)) {
    console.error('исходник пакета не найден: miniapps/' + PLUGIN_ID);
    process.exit(2);
  }
  const dst = targetDir();
  const d = diff(SRC, dst);

  if (check) {
    if (d.missing.length || d.changed.length || d.extra.length) {
      console.log('пакет в профиле разошёлся с исходником:');
      for (const f of d.missing) console.log('  нет: ' + f);
      for (const f of d.changed) console.log('  отличается: ' + f);
      for (const f of d.extra) console.log('  лишнее: ' + f);
      process.exit(1);
    }
    console.log(`пакет в профиле совпадает с исходником (${d.total} файлов)`);
    return;
  }

  const n = install(SRC, dst);
  const after = diff(SRC, dst);
  console.log(`установлено файлов: ${n} → ${dst}`);
  if (after.missing.length || after.changed.length || after.extra.length) {
    console.error('после установки остались расхождения');
    process.exit(1);
  }
  console.log('паритет с исходником подтверждён');
}

if (require.main === module) main();

module.exports = { install, diff, listFiles, targetDir, profileDir, SRC, PLUGIN_ID };
