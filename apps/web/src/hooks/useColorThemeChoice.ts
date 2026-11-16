import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import type {
  AccountPreferences,
  AccountPreferencesPatch,
} from '@/lib/api/endpoints/userPreferences';
import { PALETTES, THEMES, customThemeFrom, paletteName, type Palette } from '@/utils/colorThemes';

// The theme and palette options, and the preference patch that picks a palette. Shared by
// the preferences page and the header's interface menu.
export function useColorThemeChoice(prefs: AccountPreferences) {
  const t = useTranslations('account.preferences');
  const { resolvedTheme } = useTheme();

  const themeOptions = THEMES.map((value) => ({ value, label: t(`themeOptions.${value}`) }));
  const paletteOptions = PALETTES.map((value) => ({
    value,
    label:
      value === 'default' || value === 'custom'
        ? t(`paletteOptions.${value}`)
        : (paletteName(value) ?? value),
  }));

  const patchFor = (palette: Palette): AccountPreferencesPatch => {
    if (palette !== 'custom' || prefs.customTheme) return { palette };
    // The first custom palette starts from the colors on screen.
    const from = prefs.palette === 'custom' ? 'default' : prefs.palette;
    return { palette, customTheme: customThemeFrom(from, resolvedTheme === 'dark') };
  };

  return { themeOptions, paletteOptions, patchFor };
}
