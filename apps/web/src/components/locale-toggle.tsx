'use client';

import { Check, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LOCALES, LOCALE_FLAGS, LOCALE_LABELS, type Locale } from '@/i18n/locales';
import { useUpdateAccountPreferences } from '@/services/preferences.service';

// Picks the interface language. The choice is saved to the account, the same as
// picking it in preferences, so it survives a new session and reaches other devices;
// PreferencesSync writes the cookie the server renders from and re-renders the page.
export function LocaleToggle() {
  const t = useTranslations('common');
  const locale = useLocale();
  const update = useUpdateAccountPreferences();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              aria-label={t('language')}
            >
              <Languages />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('language')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {LOCALES.map((value) => (
          <DropdownMenuItem key={value} onSelect={() => update.mutate({ locale: value })}>
            <span aria-hidden>{LOCALE_FLAGS[value]}</span>
            {LOCALE_LABELS[value]}
            {value === (locale as Locale) && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
