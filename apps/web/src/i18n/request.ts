import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { localeFromAcceptLanguage } from './accept-language';
import { LOCALE_COOKIE, isLocale } from './locales';
import { loadMessages } from './messages';

// The app has no `[locale]` route segment, so every URL stays the same in every
// language. The account preference is the durable copy, the cookie selects later
// server renders, and the browser preference selects the first render without one.
export default getRequestConfig(async () => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie)
    ? cookie
    : localeFromAcceptLanguage((await headers()).get('accept-language'));

  return {
    locale,
    messages: await loadMessages(locale),
    // What "3 hours ago" is measured against. One value per request, shared by the
    // server render and the client, so a relative time is not computed from two
    // different clocks and the markup matches on hydration.
    now: new Date(),
  };
});
