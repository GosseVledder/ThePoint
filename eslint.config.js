import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.output/', '.wxt/', 'node_modules/', 'e2e/screenshots/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
  },
  {
    // Node-side tooling: scripts, end-to-end tests and unit tests.
    files: ['scripts/**', 'e2e/**', 'tests/**', '*.config.*'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['tests/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  prettier,
);
