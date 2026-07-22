import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Shared ESLint flat config for all Node/Bun packages in the monorepo.
 * Non-type-checked: fast, no per-package tsconfig wiring required.
 * eslint-config-prettier is loaded last to disable rules that conflict
 * with Prettier formatting.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Allow intentionally unused identifiers prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  eslintConfigPrettier,
  {
    ignores: ['dist/**', '.next/**', 'node_modules/**'],
  },
];
