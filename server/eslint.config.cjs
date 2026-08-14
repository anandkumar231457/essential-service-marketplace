// Server-specific ESLint flat config. Extends the shared root base
// and adds Node.js globals.
const base = require('../eslint.config.base.cjs');
const globals = require('globals');

module.exports = [
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
];