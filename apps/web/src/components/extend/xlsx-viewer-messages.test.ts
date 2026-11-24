import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCALES } from '@/i18n/locales';
import { XLSX_VIEWER_MESSAGES } from './xlsx-viewer-messages';

// What @extend-ai/react-xlsx bundles. It picks a catalogue by the language of the
// locale, so `pt-BR` gets `pt`.
const ENGINE_LANGUAGES = ['en', 'fr', 'de', 'es', 'ja', 'pt', 'it', 'zh'];

describe('XLSX_VIEWER_MESSAGES', () => {
  it('covers every interface language the engine has no catalogue for', () => {
    const uncovered = LOCALES.filter(
      (locale) =>
        !(locale in XLSX_VIEWER_MESSAGES) &&
        !ENGINE_LANGUAGES.includes(new Intl.Locale(locale).language),
    );
    assert.deepEqual(uncovered, []);
  });
});
