'use strict';

/**
 * Адаптер Gemini (Antigravity) для ядра «Формы»: вкладка «Форма» (роли узлов и Run из .agents/plugins/forma/agents).
 * Ядро находит его само — файл `forma-adapter.cjs` в каталоге с точкой; форма объекта — в шапке `.forma/dashboard/lib/engines.cjs`.
 * Другие поля формы адаптер не объявляет: ядро подставляет `unknown`.
 */

const path = require('path');
const { readMdCatalog } = require('../.forma/dashboard/lib/forma-roles.cjs');

module.exports = {
  engine: 'gemini',
  formaRoles: (root) => {
    const cat = readMdCatalog(root, {
      title: 'Gemini',
      rolesDir: '.agents/plugins/forma/agents',
      mcpFiles: [
        { file: path.join(root, '.agents', 'mcp_config.json'), level: 'проект (.agents/mcp_config.json)' },
        { file: path.join(root, '.agents', 'plugins', 'forma', 'mcp_config.json'), level: 'плагин (.agents/plugins/forma/mcp_config.json)' },
      ],
    });
    cat.plugins = null;
    return cat;
  },
};
