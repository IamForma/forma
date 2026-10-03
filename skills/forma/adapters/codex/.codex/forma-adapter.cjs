'use strict';

/**
 * Адаптер Codex для ядра «Формы»: вкладка «Форма» (роли узлов из .codex/agents/*.toml).
 * Ядро находит его само — файл `forma-adapter.cjs` в каталоге с точкой; форма объекта — в шапке `.forma/dashboard/lib/engines.cjs`.
 * Другие поля формы адаптер не объявляет: ядро подставляет `unknown`.
 */

const { readTomlCatalog } = require('../dashboard/lib/forma-roles.cjs');

module.exports = {
  engine: 'codex',
  formaRoles: (root) => {
    const cat = readTomlCatalog(root, { title: 'Codex', agentsDir: '.codex/agents' });
    cat.plugins = null; // списка плагинов у движка для вкладки нет
    return cat;
  },
};
