import { LOCALE_COOKIE, type Locale } from './locales';

const ONE_YEAR = 60 * 60 * 24 * 365;

// Mirrors the chosen language into the cookie the server renders from. The account
// preference stays the durable copy; this is what makes the next server render, and
// every signed-out screen, come back in the same language.
export function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}
