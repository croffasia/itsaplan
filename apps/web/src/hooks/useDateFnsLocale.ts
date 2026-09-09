'use client';

import { useLocale } from 'next-intl';
import {
  enUS,
  uk,
  ru,
  zhCN,
  ar,
  fr,
  ptBR,
  id,
  type Locale as DateFnsLocale,
} from 'date-fns/locale';

// The date-fns locale matching the interface language, for the components that
// format dates themselves instead of going through next-intl (the calendar's
// month and weekday names).
const LOCALES: Record<string, DateFnsLocale> = {
  en: enUS,
  uk,
  ru,
  'zh-CN': zhCN,
  ar,
  fr,
  'pt-BR': ptBR,
  id,
};

export function useDateFnsLocale(): DateFnsLocale {
  return LOCALES[useLocale()] ?? enUS;
}
