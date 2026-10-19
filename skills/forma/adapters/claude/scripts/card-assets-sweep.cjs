#!/usr/bin/env node
'use strict';

// Страховка правила «изображение карточки живёт в project/cards/card-NNN/assets/».
// Находит изображения в project/cards/card-NNN/** вне assets/ и work/, переносит в assets/ с тем же подпутём
// и правит ссылки на старый путь в карточках доски и в материалах карточек. Конфликт имён — не перезаписывает, а сообщает.
// Запуск: node .claude/scripts/card-assets-sweep.cjs [--dry]. Никогда не блокирует: код выхода 0, пока нет сбоя чтения.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const CARDS = path.join(ROOT, 'project', 'cards');
const BOARD = path.join(ROOT, '.devtool', 'features');
const DRY = process.argv.includes('--dry');
const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp|tiff?|ico)$/i;
const SKIP = new Set(['assets', 'work']);
const TEXT = /\.(md|cjs|js|json|html|css|php)$/i;

function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) { if (!SKIP.has(e.name)) out.push(...walk(path.join(dir, e.name), rel)); }
    else out.push(rel);
  }
  return out;
}

function textFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'assets') out.push(...textFiles(abs)); }
    else if (TEXT.test(e.name)) out.push(abs);
  }
  return out;
}

const moved = [];
const conflicts = [];
if (fs.existsSync(CARDS)) {
  for (const card of fs.readdirSync(CARDS)) {
    if (!/^card-\d+$/.test(card) || !fs.statSync(path.join(CARDS, card)).isDirectory()) continue;
    for (const rel of walk(path.join(CARDS, card))) {
      if (!IMAGE.test(rel)) continue;
      const from = path.join(CARDS, card, rel);
      const to = path.join(CARDS, card, 'assets', rel);
      if (fs.existsSync(to)) { conflicts.push(`project/cards/${card}/${rel}: в assets/ уже есть такой файл — не перезаписан`); continue; }
      if (!DRY) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(from, to); }
      moved.push({ card, rel });
    }
  }
}

// Ссылки: полный путь project/cards/card-NNN/<rel> → .../assets/<rel>. Остальные упоминания только называем.
const stale = [];
if (moved.length && !DRY) {
  const scan = [...textFiles(BOARD), ...textFiles(path.join(ROOT, 'project'))];
  for (const file of scan) {
    let body = fs.readFileSync(file, 'utf8');
    let next = body;
    for (const { card, rel } of moved) {
      next = next.split(`project/cards/${card}/${rel}`).join(`project/cards/${card}/assets/${rel}`);
      if (next.includes(`${card}/${rel}`) && !next.includes(`${card}/assets/${rel}`)) stale.push(`${path.relative(ROOT, file)}: ${card}/${rel}`);
    }
    if (next !== body) fs.writeFileSync(file, next);
  }
}

for (const { card, rel } of moved) console.log(`${DRY ? 'перенёс бы' : 'перенёс'}: project/cards/${card}/${rel} → assets/${rel}`);
for (const c of conflicts) console.log(`конфликт: ${c}`);
for (const s of [...new Set(stale)]) console.log(`проверить ссылку вручную: ${s}`);
