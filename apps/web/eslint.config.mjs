import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextJsConfig } from '@repo/eslint-config/next';
import i18nJson from 'eslint-plugin-i18n-json';

// English is the source language, so every locale is compared against the same
// namespace in `messages/en`. The comparison rules take one reference file each, so
// there is one config block per namespace rather than one for the whole folder.
const messagesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'messages');
const namespaces = fs.readdirSync(path.join(messagesDir, 'en'));

// The rules below only see files that exist, so a namespace a language does not
// carry at all would pass unnoticed. It fails here instead.
for (const locale of fs.readdirSync(messagesDir)) {
  const missing = namespaces.filter((ns) => !fs.existsSync(path.join(messagesDir, locale, ns)));
  if (missing.length > 0) throw new Error(`messages/${locale} is missing: ${missing.join(', ')}`);
}

const jsonProcessor = { meta: { name: '.json' }, ...i18nJson.processors['.json'] };

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  ...namespaces.map((namespace) => ({
    files: [`messages/*/${namespace}`],
    plugins: { 'i18n-json': i18nJson },
    processor: jsonProcessor,
    rules: {
      'i18n-json/valid-json': 'error',
      'i18n-json/valid-message-syntax': ['error', { syntax: 'icu' }],
      // A key added to English without the same key in every other language, or one
      // left behind in a single language, fails the lint.
      'i18n-json/identical-keys': ['error', { filePath: path.join(messagesDir, 'en', namespace) }],
      // identical-placeholders stays off: it compares the plural categories of a
      // message too, and those differ by language by design (zh has only `other`,
      // ru and uk have `few` and `many` where English has `one`).
    },
  })),
];
