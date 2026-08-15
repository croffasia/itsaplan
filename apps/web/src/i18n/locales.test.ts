import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCALES, localeDirection } from './locales';

describe('localeDirection', () => {
  it('mirrors the interface for Arabic', () => {
    assert.equal(localeDirection('ar'), 'rtl');
  });

  it('leaves every other shipped language left to right', () => {
    for (const locale of LOCALES.filter((l) => l !== 'ar')) {
      assert.equal(localeDirection(locale), 'ltr');
    }
  });
});
