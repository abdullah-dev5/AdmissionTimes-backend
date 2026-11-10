// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'api/**', 'node_modules/**', 'coverage/**', 'supabase/**', 'scripts/**', 'tests/e2e/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // Application code logs through shared/utils/logger.
      'no-console': 'warn',
      eqeqeq: ['error', 'smart'],
      'no-return-await': 'off',
      'prefer-const': 'error',
      // Tracked for gradual cleanup (mostly untyped DB rows); new code should not add more.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
);
