import { config } from '@repo/eslint-config/base';

/**
 * Root fallback config: applies to repo-level files and the eslint-config
 * package itself. Each app/package has its own eslint.config.mjs which takes
 * precedence for files inside it (ESLint uses the nearest config).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default config;
