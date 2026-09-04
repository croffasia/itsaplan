import { describe, expect, it } from 'bun:test';
import { localeFromAcceptLanguage } from '../../locale';

describe('localeFromAcceptLanguage', () => {
  it('uses the preferred supported language', () => {
    expect(localeFromAcceptLanguage('ru;q=0.4,zh-CN;q=0.9,en;q=0.8')).toBe('zh-CN');
  });

  it('matches a supported base language to a regional browser locale', () => {
    expect(localeFromAcceptLanguage('uk-UA,uk;q=0.9,en;q=0.8')).toBe('uk');
  });

  it('matches a regional Arabic browser locale to the supported base language', () => {
    expect(localeFromAcceptLanguage('ar-SA,ar;q=0.9,en;q=0.8')).toBe('ar');
  });

  it('uses the fallback for a preferred wildcard', () => {
    expect(localeFromAcceptLanguage('de-DE,*;q=0.9,zh;q=0.8')).toBe('en');
  });

  it('falls back to English when no requested language is supported', () => {
    expect(localeFromAcceptLanguage('de-DE,ja;q=0.9')).toBe('en');
  });
});
