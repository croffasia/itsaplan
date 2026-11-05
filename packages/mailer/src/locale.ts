// The languages the interface and the emails ship with. The web app keeps its own copy of
// this list and of the matcher below: it never imports a package.
export const LOCALES = [
  'en',
  'uk',
  'ru',
  'zh-CN',
  'zh-TW',
  'ar',
  'fa',
  'fr',
  'pt-BR',
  'id',
  'es-ES',
  'ko',
  'tr',
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

const RTL_LOCALES: readonly Locale[] = ['ar', 'fa'];

export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

// Keep this matcher aligned with the Web copy so the first server render and
// an account without saved preferences resolve to the same language.
export function localeFromAcceptLanguage(value: string | null): Locale {
  const requested = (value ?? '')
    .split(',')
    .map((part, index) => {
      const [tag, ...parameters] = part.trim().split(';');
      const qualityValue = parameters
        .map((parameter) => parameter.trim().toLowerCase())
        .find((parameter) => parameter.startsWith('q='))
        ?.slice(2);
      const quality = qualityValue === undefined ? 1 : Number(qualityValue);
      return { tag: tag.toLowerCase(), quality, index };
    })
    .filter(({ tag, quality }) => tag && quality > 0 && quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { tag } of requested) {
    if (tag === '*') return DEFAULT_LOCALE;

    const exact = LOCALES.find((locale) => locale.toLowerCase() === tag);
    if (exact) return exact;

    const language = tag.split('-')[0];
    const sameLanguage = LOCALES.find((locale) => locale.toLowerCase().split('-')[0] === language);
    if (sameLanguage) return sameLanguage;
  }

  return DEFAULT_LOCALE;
}
