import { ONE_YEAR } from '@/i18n/cookie';
import type { ThemePreference } from '@/lib/api/endpoints/userPreferences';
import type { CustomTheme } from './customTheme';

export const THEMES: ThemePreference[] = ['system', 'light', 'dark'];

// The palettes globals.css draws under `:root[data-palette="<id>"]`, each in a light
// and a dark version. 'default' is the base :root and .dark tokens; 'custom' is drawn
// from the user's own three colors (see customTheme.ts).
export const PALETTES = [
  'default',
  'github',
  'nord',
  'catppuccin',
  'one',
  'tomorrow',
  'nightfox',
  'custom',
] as const;

export type Palette = (typeof PALETTES)[number];
export type BuiltInPalette = Exclude<Palette, 'custom'>;

// The proper name of each palette, the same in every language (Default is translated),
// and its background and accent in light and dark. A new custom theme starts from the
// palette on screen.
const BUILT_IN: Record<
  BuiltInPalette,
  { name?: string; light: [string, string]; dark: [string, string] }
> = {
  default: { light: ['#fafafa', '#1b1b1b'], dark: ['#131313', '#e8e8e8'] },
  github: { name: 'GitHub', light: ['#f6f8fa', '#0969da'], dark: ['#0d1117', '#1f6feb'] },
  nord: { name: 'Nord', light: ['#eceff4', '#5578a3'], dark: ['#2e3440', '#88c0d0'] },
  catppuccin: {
    name: 'Catppuccin',
    light: ['#eff1f5', '#8839ef'],
    dark: ['#1e1e2e', '#cba6f7'],
  },
  one: { name: 'One', light: ['#fafafa', '#376ee8'], dark: ['#282c34', '#61afef'] },
  tomorrow: { name: 'Tomorrow', light: ['#fafafa', '#4271ae'], dark: ['#1d1f21', '#81a2be'] },
  nightfox: { name: 'Nightfox', light: ['#f6f2ee', '#2848a9'], dark: ['#192330', '#719cd6'] },
};

export const paletteName = (palette: BuiltInPalette) => BUILT_IN[palette].name;

export function customThemeFrom(palette: BuiltInPalette, dark: boolean): CustomTheme {
  const [background, accent] = BUILT_IN[palette][dark ? 'dark' : 'light'];
  return { accent, background, contrast: 30 };
}

// '#5E6AD2' or '5e6ad2' as '#5e6ad2'; null for anything else.
export function toHex(value: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

function toCustomTheme(accent: unknown, background: unknown, contrast: unknown) {
  const a = typeof accent === 'string' ? toHex(accent) : null;
  const b = typeof background === 'string' ? toHex(background) : null;
  const c = typeof contrast === 'number' ? contrast : Number.NaN;
  if (!a || !b || !Number.isInteger(c) || c < 0 || c > 100) return null;
  return { accent: a, background: b, contrast: c };
}

// The text "Copy" puts on the clipboard and "Import" reads back.
export const formatCustomTheme = (theme: CustomTheme) => JSON.stringify(theme);

export function parseCustomTheme(text: string): CustomTheme | null {
  try {
    const v = JSON.parse(text) as Record<string, unknown> | null;
    return v && typeof v === 'object' ? toCustomTheme(v.accent, v.background, v.contrast) : null;
  } catch {
    return null;
  }
}

// The palette the server renders with. The account preference is the durable copy;
// the cookie lets the server paint the right colors before the account loads. Its
// value is 'nord', or 'custom-5e6ad2-101012-30', so it needs no encoding.
export const COLOR_THEME_COOKIE = 'itsaplan-color-theme';

export function colorThemeCookieValue(palette: Palette, custom: CustomTheme | null): string {
  if (palette !== 'custom') return palette;
  if (!custom) return 'default';
  return `custom-${custom.accent.slice(1)}-${custom.background.slice(1)}-${custom.contrast}`;
}

export function parseColorThemeCookie(value: string | undefined): {
  palette: Palette;
  custom: CustomTheme | null;
} {
  const m = /^custom-([0-9a-f]{6})-([0-9a-f]{6})-(\d{1,3})$/.exec(value ?? '');
  const custom = m ? toCustomTheme(m[1], m[2], Number(m[3])) : null;
  if (custom) return { palette: 'custom', custom };
  const palette = PALETTES.find((p) => p !== 'custom' && p === value);
  return { palette: palette ?? 'default', custom: null };
}

// No cookie means the server rendered the default palette.
export function readColorThemeCookie(): string {
  const prefix = `${COLOR_THEME_COOKIE}=`;
  const entry = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  return entry?.slice(prefix.length) ?? 'default';
}

export function setColorThemeCookie(value: string) {
  document.cookie = `${COLOR_THEME_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}
