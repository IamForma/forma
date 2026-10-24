'use strict';

/**
 * Как движок MiniMax виден в расходе дашборда: что дашборд считает по моим строкам.
 *
 * Дашборд берёт расход из карточек (строки расхода в `## История`) и режет его по метке
 * движка — общим выражением, без белого списка. Значит метка `minimax:` попадает в свою
 * колонку сама. Скрипт показывает, что именно он видит, и где «слепые пятна».
 *
 * Запуск: node .minimax/scripts/spend-view.cjs
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');

function build() {
  // Дашборд — ядро: читаем его сборщик, а не повторяем его разбор.
  const { buildData } = require(path.join(ROOT, '.forma', 'dashboard', 'generate.js'));
  const data = buildData(ROOT);
  return data;
}

function main() {
  const data = build();
  console.log('ключи сборки дашборда: ' + Object.keys(data || {}).join(', '));
  const spend = (data && (data.spend || data.dash)) || {};
  const economy = spend.economy || (data && data.economy) || {};
  const byEngine = economy.byEngine || { keys: [], columns: {}, common: {} };

  console.log('движок        попыток  секунд  строк  токенов  кэш-чтение  карточек');
  for (const k of byEngine.keys || []) {
    const c = byEngine.columns[k] || {};
    console.log(
      `${k.padEnd(13)} ${String(c.attempts || 0).padStart(7)} ${String(c.seconds || 0).padStart(7)} ` +
      `${String(c.lines || 0).padStart(6)} ${String(c.tokens == null ? '—' : c.tokens).padStart(8)} ` +
      `${String(c.cacheRead == null ? '—' : c.cacheRead).padStart(12)} ${String(c.cards || 0).padStart(8)}`
    );
  }
  if (!(byEngine.keys || []).includes('minimax')) {
    console.log('\nminimax в разрезе нет: строки расхода этого движка не дошли до дашборда.');
  }

  const engines = economy.engines || {};
  for (const k of Object.keys(engines)) {
    const v = engines[k] || {};
    const t = (v.totals) || {};
    console.log(`\nдвижок ${k}: попыток ${t.attemptCount == null ? '—' : t.attemptCount}, ` +
      `токенов ${t.tokens == null ? '—' : t.tokens}, кэш ${t.cacheRead == null ? '—' : t.cacheRead}`);
  }

  const ledger = path.join(ROOT, '.minimax', '.ledger', 'calls.jsonl');
  const lines = fs.existsSync(ledger)
    ? fs.readFileSync(ledger, 'utf8').split(/\r?\n/).filter((l) => l.trim())
    : [];
  const unknown = lines.filter((l) => {
    try { return JSON.parse(l).input_tokens == null; } catch { return true; }
  });
  console.log(`\nжурнал движка: записей ${lines.length}, без чисел расхода ${unknown.length}`);

  // Сырой разбор `tally` — чтобы видеть, что именно он взял и что назвал неразобранным.
  const { tally } = require(path.join(ROOT, '.forma', 'dashboard', 'tally.cjs'));
  const t = tally([path.join(ROOT, '.devtool', 'features')]);
  console.log(`tally: файлов ${t.filesProcessed}, карточек с заходом ${t.cardsWithAttempt}, ` +
    `неразобранных ${t.unparsed.length}`);
  for (const k of Object.keys(t.byEngine)) {
    const c = t.byEngine[k];
    console.log(`  движок ${k}: попыток ${c.attempts}, секунд ${c.seconds}, токенов ${c.tokens}, ` +
      `кэш ${c.cacheRead}, неизвестных ${c.unknown ? c.unknown.tokens : 0}`);
  }
  for (const u of t.unparsed.slice(0, 6)) {
    console.log('  не разобрано: ' + String(u.line || u).slice(0, 120));
  }
}

if (require.main === module) main();

module.exports = { build };
