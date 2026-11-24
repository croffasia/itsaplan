// The languages the interface ships with. `en` is the source language: every key
// exists in `messages/en.json`, and a missing translation falls back to it. Every
// language list shows this order: sorted by the name of the language in itself, so
// Latin script comes first, then Cyrillic, Arabic, Chinese and Korean.
export const LOCALES = [
  'id',
  'en',
  'es-ES',
  'fr',
  'it',
  'pt-BR',
  'tr',
  'ru',
  'uk',
  'ar',
  'fa',
  'zh-CN',
  'zh-TW',
  'ko',
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

// Read on the server to render the first paint in the right language. Written by
// the language switcher next to the account preference, so a signed-out screen
// (login, invite, shared issue) keeps the last choice too.
export const LOCALE_COOKIE = 'NEXT_LOCALE';

// Each language named in itself, which is what a person scanning the list looks for.
export const LOCALE_LABELS: Record<Locale, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
  'es-ES': 'Español (España)',
  fr: 'Français',
  it: 'Italiano',
  'pt-BR': 'Português (Brasil)',
  tr: 'Türkçe',
  ru: 'Русский',
  uk: 'Українська',
  ar: 'العربية (المصرية)',
  fa: 'فارسی',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文（台灣）',
  ko: '한국어',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

// The languages written right to left. Listed rather than derived from
// `Intl.Locale`, so adding a language is a deliberate choice of direction.
const RTL_LOCALES: readonly Locale[] = ['ar', 'fa'];

// Set on <html> during the server render, so the first paint is already mirrored
// and the layout does not flip after hydration.
export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}
