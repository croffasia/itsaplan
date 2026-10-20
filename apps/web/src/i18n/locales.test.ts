import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCALES, localeDirection } from './locales';

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
