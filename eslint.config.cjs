// ESLint протокола — только для разработки движка, в проекты не ставится (package.json, «files»).
// Правила минимальные: цель — точка отсчёта серии рефакторинга, а не исправление.
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'test/.baseline/**',
      '**/skill-creator/**',        // вендорный, из anthropics/skills
      'skills/forma/adapters/codex/**', // зона Codex
      'skills/forma/adapters/gemini/**', // зона Gemini
    ],
  },
  {
    files: ['**/*.{js,cjs}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: {
      'no-unused-vars': ['warn', { args: 'after-used', caughtErrors: 'none' }],
      'no-empty': 'warn',
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 4],
    },
  },
  {
    // Браузерные скрипты дашборда: классические <script src> в одной глобальной области, без модулей.
    // Функцию верхнего уровня зовёт другой файл, линтеру этого не видно — «не используется» считается только внутри функций.
    files: ['skills/forma/core/dashboard/web/js/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser, marked: 'readonly' } },
    rules: { 'no-unused-vars': ['warn', { vars: 'local', args: 'after-used', caughtErrors: 'none' }] },
  },
];
