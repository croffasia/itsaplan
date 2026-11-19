'use client';

import { useTranslations } from 'next-intl';
import type {
  AccountPreferences,
  AccountPreferencesPatch,
} from '@/lib/api/endpoints/userPreferences';
import { useColorThemeChoice } from '@/hooks/useColorThemeChoice';
import AccountCustomTheme from './AccountCustomTheme';
import AccountPreferenceRow from './AccountPreferenceRow';
import AccountPreferenceSelect from './AccountPreferenceSelect';

// The theme and palette rows of the Appearance section, and the fields of a custom
// palette while one is picked. A custom palette is light or dark by its background,
// so the theme row then shows that instead of a choice.
export default function AccountPreferencesColorTheme({
  prefs,
  save,
  saveQuietly,
  disabled,
}: {
  prefs: AccountPreferences;
  save: (patch: AccountPreferencesPatch) => void;
  // For edits whose result is already on screen, such as the custom colors.
  saveQuietly: (patch: AccountPreferencesPatch) => void;
  disabled: boolean;
}) {
  const t = useTranslations('account.preferences');
  const { themeOptions, paletteOptions, patchFor } = useColorThemeChoice(prefs);
  const custom = prefs.palette === 'custom' ? prefs.customTheme : null;

  return (
    <>
      <AccountPreferenceRow
        label={t('theme')}
        description={custom ? undefined : t('themeDescription')}
      >
        {custom ? (
          <span className="text-sm text-muted-foreground">{t('themeFromBackground')}</span>
        ) : (
          <AccountPreferenceSelect
            value={prefs.theme}
            options={themeOptions}
            onChange={(theme) => save({ theme })}
            disabled={disabled}
          />
        )}
      </AccountPreferenceRow>
      <AccountPreferenceRow label={t('palette')} description={t('paletteDescription')}>
        <AccountPreferenceSelect
          value={prefs.palette}
          options={paletteOptions}
          onChange={(palette) => save(patchFor(palette))}
          disabled={disabled}
        />
      </AccountPreferenceRow>
      {custom && (
        <AccountCustomTheme
          theme={custom}
          onChange={(theme) => saveQuietly({ customTheme: theme })}
        />
      )}
    </>
  );
}
