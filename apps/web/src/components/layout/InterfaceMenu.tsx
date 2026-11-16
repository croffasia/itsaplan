'use client';

import Link from 'next/link';
import { MonitorCog } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DisplaySettingsRow from '@/components/layout/DisplaySettingsRow';
import DisplaySettingsSelect from '@/components/layout/DisplaySettingsSelect';
import { useColorThemeChoice } from '@/hooks/useColorThemeChoice';
import { LOCALES, LOCALE_FLAGS, LOCALE_LABELS, type Locale } from '@/i18n/locales';
import type { ThemePreference } from '@/lib/api/endpoints/userPreferences';
import { useAccountPreferences, useUpdateAccountPreferences } from '@/services/preferences.service';
import { accountPath } from '@/utils/accountSections';
import type { Palette } from '@/utils/colorThemes';

// The header's interface settings: language, theme and palette. Each choice saves to
// the account, the same as on the preferences page, and PreferencesSync applies it.
// A custom palette can be picked here; its colors are edited on the preferences page,
// and its background sets light or dark, so the theme row is left out.
export default function InterfaceMenu() {
  const t = useTranslations('account.preferences');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;
  const prefs = useAccountPreferences();
  const update = useUpdateAccountPreferences();
  const choice = useColorThemeChoice(prefs);

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              aria-label={tCommon('interface')}
            >
              <MonitorCog />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{tCommon('interface')}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 p-2">
        <DisplaySettingsRow label={tCommon('language')}>
          <DisplaySettingsSelect
            value={locale}
            onChange={(value) => update.mutate({ locale: value as Locale })}
            options={LOCALES.map((value) => ({
              value,
              label: `${LOCALE_FLAGS[value]} ${LOCALE_LABELS[value]}`,
            }))}
          />
        </DisplaySettingsRow>
        {prefs.palette !== 'custom' && (
          <DisplaySettingsRow label={t('theme')}>
            <DisplaySettingsSelect
              value={prefs.theme}
              onChange={(value) => update.mutate({ theme: value as ThemePreference })}
              options={choice.themeOptions}
            />
          </DisplaySettingsRow>
        )}
        <DisplaySettingsRow label={t('palette')}>
          <DisplaySettingsSelect
            value={prefs.palette}
            onChange={(value) => update.mutate(choice.patchFor(value as Palette))}
            options={choice.paletteOptions}
          />
        </DisplaySettingsRow>
        <Separator className="my-2" />
        <Link
          href={accountPath('preferences')}
          className="flex h-8 items-center rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {tCommon('allPreferences')}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
