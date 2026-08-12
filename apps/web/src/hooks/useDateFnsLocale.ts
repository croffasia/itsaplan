'use client';

import { useLocale } from 'next-intl';
import { enUS, uk, zhCN, type Locale as DateFnsLocale } from 'date-fns/locale';

// The date-fns locale matching the interface language, for the components that
// format dates themselves instead of going through next-intl (the calendar's
// month and weekday names).
const LOCALES: Record<string, DateFnsLocale> = { en: enUS, uk, 'zh-CN': zhCN };

export function useDateFnsLocale(): DateFnsLocale {
  return LOCALES[useLocale()] ?? enUS;
}
