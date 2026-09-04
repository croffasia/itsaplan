// The languages the interface ships with. `en` is the source language: every key
// exists in `messages/en.json`, and a missing translation falls back to it.
export const LOCALES = ['en', 'uk', 'ru', 'zh-CN', 'ar', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

// Read on the server to render the first paint in the right language. Written by
// the language switcher next to the account preference, so a signed-out screen
// (login, invite, shared issue) keeps the last choice too.
export const LOCALE_COOKIE = 'NEXT_LOCALE';

// Each language named in itself, which is what a person scanning the list looks for.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
  'zh-CN': '简体中文',
  ar: 'العربية (المصرية)',
  fr: 'Français',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  uk: '🇺🇦',
  ru: '🇷🇺',
  'zh-CN': '🇨🇳',
  ar: '🇪🇬',
  fr: '🇫🇷',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value);
}

// The languages written right to left. Listed rather than derived from
// `Intl.Locale`, so adding a language is a deliberate choice of direction.
const RTL_LOCALES: readonly Locale[] = ['ar'];

// Set on <html> during the server render, so the first paint is already mirrored
// and the layout does not flip after hydration.
export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}
