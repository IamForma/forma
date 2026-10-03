#!/usr/bin/env node
// Запуск скрипта в контексте карточки — связь «скрипт ↔ карточка» делает движок, а не текст скрипта (AGENTS.md §5, запрет 16).
//
//   node .forma/board/run-in-card.cjs <card> -- <команда> [аргументы…]      <card> — «NNN» или «card-NNN»
//
// Проверяет, что карточка есть на доске (живая или в done/), и отдаёт команде в окружение:
//   CARD_ID     — код карточки, `card-NNN`
//   CARD_DIR    — абсолютный путь папки материалов, `project/cards/card-NNN` (AGENTS.md §6); папку не создаёт —
//                 её заводит скрипт, когда есть что положить (проверка card-materials ругается на пустую)
//   CARD_ASSETS — `CARD_DIR/assets`, активы вне git
//   CARD_WORK   — `CARD_DIR/work`, рабочий материал вне git
// Скрипт номеров карточек не знает: пути берёт из `--out`-аргументов или из CARD_*; рядом нет — нейтральный дефолт.
// Часть ядра: одна для всех движков, путей движка не знает. Код выхода — код команды.

const path = require('path');
const { spawnSync } = require('child_process');
const { cardFiles } = require('../dashboard/lib/card.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

/** `NNN` | `card-NNN` → `card-NNN`; иначе null. */
function normalize(card) {
  const m = String(card || '').match(/^(?:card-)?(\d+)$/);
  return m ? 'card-' + m[1].padStart(3, '0') : null;
}

/** Окружение карточки: CARD_ID/DIR/ASSETS/WORK. Бросает, если карточки на доске нет. */
function cardEnv(root, card) {
  const id = normalize(card);
  if (!id) throw new Error(`"${card}" — не код карточки (ожидается NNN или card-NNN)`);
  const exists = cardFiles(root, /^card-\d+-.*\.md$/).some((f) => path.basename(f).startsWith(id + '-'));
  if (!exists) throw new Error(`карточки ${id} нет на доске`);
  const dir = path.join(root, 'project', 'cards', id);
  return { CARD_ID: id, CARD_DIR: dir, CARD_ASSETS: path.join(dir, 'assets'), CARD_WORK: path.join(dir, 'work') };
}

module.exports = { cardEnv, normalize };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const sep = argv.indexOf('--');
  if (sep < 1 || sep === argv.length - 1) {
    console.error('run-in-card: usage: node .forma/board/run-in-card.cjs <card> -- <команда> [аргументы…]');
    process.exit(2);
  }
  let env;
  try { env = cardEnv(ROOT, argv[0]); } catch (e) { console.error('run-in-card: ' + e.message); process.exit(2); }
  const [cmd, ...args] = argv.slice(sep + 1);
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, env: { ...process.env, ...env } });
  if (res.error) { console.error('run-in-card: ' + res.error.message); process.exit(2); }
  process.exit(res.status === null ? 1 : res.status);
}
