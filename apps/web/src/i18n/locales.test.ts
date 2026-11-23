import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCALES, LOCALE_LABELS, localeDirection } from './locales';

describe('localeDirection', () => {
  it('mirrors the interface for Arabic and Persian', () => {
    assert.equal(localeDirection('ar'), 'rtl');
    assert.equal(localeDirection('fa'), 'rtl');
  });

  it('leaves every other shipped language left to right', () => {
    for (const locale of LOCALES.filter((l) => l !== 'ar' && l !== 'fa')) {
      assert.equal(localeDirection(locale), 'ltr');
    }
  });
});

describe('LOCALES', () => {
  it('lists the languages sorted by their names, so a new one keeps the order', () => {
    const sorted = [...LOCALES].sort((a, b) => (LOCALE_LABELS[a] < LOCALE_LABELS[b] ? -1 : 1));
    assert.deepEqual(LOCALES, sorted);
  });
});
