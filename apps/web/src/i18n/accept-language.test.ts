import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localeFromAcceptLanguage } from './accept-language';

describe('localeFromAcceptLanguage', () => {
  it('uses the preferred supported language', () => {
    assert.equal(localeFromAcceptLanguage('ru;q=0.4,zh-CN;q=0.9,en;q=0.8'), 'zh-CN');
  });

  it('matches a supported base language to a regional browser locale', () => {
    assert.equal(localeFromAcceptLanguage('uk-UA,uk;q=0.9,en;q=0.8'), 'uk');
  });

  it('matches a regional Arabic browser locale to the supported base language', () => {
    assert.equal(localeFromAcceptLanguage('ar-SA,ar;q=0.9,en;q=0.8'), 'ar');
  });

  it('uses the fallback for a preferred wildcard', () => {
    assert.equal(localeFromAcceptLanguage('de-DE,*;q=0.9,zh;q=0.8'), 'en');
  });

  it('falls back to English when no requested language is supported', () => {
    assert.equal(localeFromAcceptLanguage('de-DE,ja;q=0.9'), 'en');
  });
});
