import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales';

// Keep this matcher aligned with the API copy so the first server render and
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
