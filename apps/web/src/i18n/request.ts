import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from './locales';
import { loadMessages } from './messages';

// The app has no `[locale]` route segment: the language comes from a cookie, so every
// URL stays the same in every language. The account preference is the durable copy
// and the switcher writes both.
export default getRequestConfig(async () => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : DEFAULT_LOCALE;

  return {
    locale,
    messages: await loadMessages(locale),
    // What "3 hours ago" is measured against. One value per request, shared by the
    // server render and the client, so a relative time is not computed from two
    // different clocks and the markup matches on hydration.
    now: new Date(),
  };
});
