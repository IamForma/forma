'use strict';

/**
 * Карточка доски (AGENTS.md §6–7): где лежат файлы, frontmatter, заголовок, метки, зоны на двух языках.
 * Часть общей библиотеки ядра (`.forma/dashboard/lib/`). Здесь читается только форма карточки — что значат поля,
 * решают вызывающие.
 */

const fs = require('fs');
const path = require('path');
const i18n = require('../../i18n/index.cjs');

/** Каталог доски: живые карточки; закрытые — в `done/` внутри него. */
const boardDir = (root) => path.join(root, '.devtool', 'features');

/**
 * Файлы карточек: сначала доска, потом `done/`; в каждом каталоге — порядок `readdir`. Нет каталога — пропущен.
 * `test` — RegExp или `(имя) => bool` по имени файла; по умолчанию — `.md`. Возвращает абсолютные пути.
 */
function cardFiles(root, test = (name) => name.endsWith('.md')) {
  const ok = test instanceof RegExp ? (name) => test.test(name) : test;
  const board = boardDir(root);
  const out = [];
  for (const dir of [board, path.join(board, 'done')]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (ok(f)) out.push(path.join(dir, f));
  }
  return out;
}

// ---- frontmatter --------------------------------------------------------------------------------

/** Блок между `---` в начале файла: единственная копия регулярки. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/** Содержимое блока frontmatter или `null`. */
function frontmatterBlock(text) {
  const m = FRONTMATTER_RE.exec(text);
  return m ? m[1] : null;
}

/** `{ block, rest }`: блок и тело после закрывающих `---` (и одного перевода строки). Нет блока — `block: null`, `rest` — весь текст. */
function splitFrontmatter(text) {
  const m = FRONTMATTER_RE.exec(text);
  if (!m) return { block: null, rest: text };
  return { block: m[1], rest: text.slice(m[0].length).replace(/^\r?\n/, '') };
}

/**
 * Поля карточки с типами: `null` — `null`, `"…"` — строка, `[…]` — массив строк, прочее — сырая строка.
 * Ключ — латиница (`[a-zA-Z]+`). Нет блока — `{}`.
 */
function parseFrontmatter(text) {
  const block = frontmatterBlock(text);
  if (block === null) return {};
  const fm = {};
  for (const line of block.split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (val === 'null') { fm[key] = null; continue; }
    if (val.startsWith('"') && val.endsWith('"')) { fm[key] = val.slice(1, -1); continue; }
    if (val.startsWith('[') && val.endsWith(']')) {
      fm[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
      continue;
    }
    fm[key] = val;
  }
  return fm;
}

/** Поля как JSON: значение — `JSON.parse`, не разобралось — сырая строка. Ключ — всё до первого `:`. Нет блока — `{}`. */
function parseFrontmatterJson(text) {
  const block = frontmatterBlock(text);
  const fm = {};
  if (block === null) return fm;
  for (const line of block.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();
    try { fm[k] = JSON.parse(raw); } catch { fm[k] = raw; }
  }
  return fm;
}

/**
 * Плоские строки frontmatter (роли, скиллы): `[поля, тело]`. Значения — строки без крайних кавычек;
 * ключ — `\w+`; разбор по `\n`, `\r` вычищает вызывающий.
 */
function parseFlatFrontmatter(text) {
  const { block, rest } = splitFrontmatter(text);
  const o = {};
  if (block !== null) block.split('\n').forEach((l) => { const k = l.match(/^(\w+):\s*(.*)$/); if (k) o[k[1]] = k[2].replace(/^["']|["']$/g, ''); });
  return [o, rest];
}

/** Значение поля по всему тексту (не только по блоку): без кавычек, `null` — `null`; поля нет — `null`. */
function field(text, key) {
  const m = text.match(new RegExp('^' + key + ':\\s*(.*)$', 'm'));
  if (!m) return null;
  const v = m[1].trim().replace(/^["']|["']$/g, '');
  return v === 'null' ? null : v;
}

/** Метки карточки — по всему тексту, `labels: [...]` в одну строку. */
function labelsOf(text) {
  const m = text.match(/^labels:\s*\[([^\]]*)\]/m);
  return m ? m[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : [];
}

/** День создания (`created`) — `ГГГГ-ММ-ДД` или пустая строка. */
function createdDay(text) {
  return (text.match(/^created:\s*"?(\d{4}-\d{2}-\d{2})/m) || [])[1] || '';
}

/** Заголовок карточки — первая строка `# …`; нет — `null`. */
function cardTitle(text) {
  const m = text.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

// ---- зоны ---------------------------------------------------------------------------------------

/** Ключи четырёх зон карточки (AGENTS.md §6): заголовок ищется по якорю `<!-- k:zone.X -->`, иначе по словарю i18n. */
const ZONES = ['task', 'kit', 'history', 'result'];

/** Заголовок зоны на языке карточки (`ru` — русский, иначе английский); `anchored` — с якорем ключа: проекту на языке без словаря перевод заголовка ключ не стирает. */
const zoneHeading = (key, lang, anchored = false) => {
  const labels = i18n.labelsOf('zone.' + key);
  const label = labels[lang === 'ru' ? labels.length - 1 : 0];
  return anchored ? label + ' ' + i18n.anchor('zone.' + key) : label;
};

/** Тело зоны, без крайних пробелов; зоны нет — пустая строка. */
function zone(text, key) {
  const head = i18n.headingRe('zone.' + key, 'm');
  const lines = String(text).split(/\r?\n/);
  const i = lines.findIndex((l) => head.test(l));
  if (i < 0) return '';
  let end = lines.findIndex((l, k) => k > i && l.startsWith('## '));
  if (end < 0) end = lines.length;
  return lines.slice(i + 1, end).join('\n').trim();
}

/** Строка-заголовок зоны «История» целиком (для построчного поиска). */
const HISTORY_HEADING_RE = i18n.headingRe('zone.history', '');

/** Текст карточки без зоны истории — строки расхода дописываются в закрытые карточки и не должны менять хэш. */
function withoutHistory(text) {
  const lines = String(text).split('\n');
  const i = lines.findIndex((l) => HISTORY_HEADING_RE.test(l.replace(/\r$/, '')));
  if (i < 0) return String(text);
  let end = lines.findIndex((l, k) => k > i && l.startsWith('## '));
  if (end < 0) end = lines.length;
  return lines.slice(0, i).concat(lines.slice(end)).join('\n');
}

module.exports = {
  boardDir, cardFiles,
  FRONTMATTER_RE, frontmatterBlock, splitFrontmatter, parseFrontmatter, parseFrontmatterJson, parseFlatFrontmatter,
  field, labelsOf, createdDay, cardTitle,
  ZONES, zoneHeading, zone, HISTORY_HEADING_RE, withoutHistory,
};
