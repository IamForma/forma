#!/usr/bin/env node
'use strict';
// Действие по человеческой команде «подключи Jev»: переключает исполнителя Отвеса с haiku на
// внешнюю решающую модель. Не вызывает Jev само — только проверяет условие и правит PROJECT.md.
//
// Использование: node .claude/scripts/plumb-switch.cjs [--root DIR]
// Код выхода 0 — переключено, напечатан вопрос, который нужно задать человеку (лимит вызовов).
// Код выхода 2 — остановка: OPENROUTER_API_KEY нет в .env, PROJECT.md не тронут (запрет 15).

const fs = require('fs');
const path = require('path');
const i18n = require('../../.forma/i18n/index.cjs');

function hasKey(root) {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return false;
  const m = /^OPENROUTER_API_KEY=(.*)$/m.exec(fs.readFileSync(envPath, 'utf8'));
  return !!(m && m[1].trim());
}

function switchProjectMd(root) {
  const file = path.join(root, 'project', 'config', 'PROJECT.md');
  const before = fs.readFileSync(file, 'utf8');
  // Меняем только слово-селектор в строке «Отвес `plumb`» (или «Plumb `plumb`» — англ. шаблон
  // нового проекта); пороги и остальной текст той же ячейки (они относятся к haiku) не трогаем —
  // запрет на самовольную установку порогов Jev.
  const after = before.replace(
    new RegExp('(\\|\\s*(?:' + i18n.alt('routes.plumb') + ') `plumb`[^|]*\\|\\s*)`haiku`'),
    '$1`jev`'
  );
  if (after === before) {
    throw new Error('строка «Отвес `plumb`» со значением `haiku` не найдена — PROJECT.md не изменён');
  }
  fs.writeFileSync(file, after, 'utf8');
  return file;
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--root');
  const root = i >= 0 ? path.resolve(argv[i + 1]) : process.cwd();

  if (!hasKey(root)) {
    console.error(
      'Остановка: OPENROUTER_API_KEY отсутствует или пуст в .env — plumb: jev не включаю, ' +
        'PROJECT.md не меняю (запрет 15, AGENTS.md §5).'
    );
    process.exit(2);
  }

  const file = switchProjectMd(root);
  console.log(`plumb: jev записан в ${file}.`);
  console.log('Пороги Haiku не менялись; отдельные пороги под jev пока не заданы — замер (п. 6 карточки) только первый шаг.');
  console.log(
    'Нужно спросить у человека: лимит вызовов Jev на цикл (число, не доллары) — сам не ставлю ' +
      '(AGENTS.md §3, «Внешняя модель отвеса» в PROJECT.md).'
  );
}

main();
