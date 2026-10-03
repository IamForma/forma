'use strict';

/**
 * Адаптер Codex для ядра «Формы»: вкладка «Форма» (роли узлов из .codex/agents/*.toml).
 * Ядро находит его само — файл `forma-adapter.cjs` в каталоге с точкой; форма объекта — в шапке `.forma/dashboard/lib/engines.cjs`.
 * Другие поля формы адаптер не объявляет: ядро подставляет `unknown`.
 */

const { readTomlCatalog, readMdCatalog } = require('../.forma/dashboard/lib/forma-roles.cjs');

module.exports = {
  engine: 'codex',
  formaRoles: (root) => {
    const cat = readTomlCatalog(root, { title: 'Codex', agentsDir: '.codex/agents' });
    const claude = readMdCatalog(root, { title: 'Claude Run profiles', rolesDir: '.claude/agents', mcpFiles: [] });
    cat.runRoles = claude.runRoles;
    cat.runNote = null;
    cat.plugins = null; // списка плагинов у движка для вкладки нет
    return cat;
  },
};
