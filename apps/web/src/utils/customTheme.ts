// Builds every color token of the app from the three values of a custom theme. Text
// and the colors that carry meaning are moved in OKLCH lightness only, hue kept, until
// they meet the APCA targets of DESIGN.md: Lc 75 for text, 60 for small state text, 45
// for the red that is both text and a button fill, 30 for the focus ring and icons.

export interface CustomTheme {
  accent: string;
  background: string;
  // 0–100: how far text and borders stand out from the background.
  contrast: number;
}

const WHITE = '#ffffff';
const BLACK = '#000000';
const INK = '#111111';

// Status colors of GitHub Primer, a neutral set that reads on most backgrounds.
const STATUS = {
  light: {
    red: '#d1242f',
    orange: '#bc4c00',
    yellow: '#9a6700',
    green: '#1a7f37',
    blue: '#0969da',
    magenta: '#8250df',
    pink: '#bf3989',
    gray: '#818b98',
  },
  dark: {
    red: '#f85149',
    orange: '#db6d28',
    yellow: '#d29922',
    green: '#3fb950',
    blue: '#4493f8',
    magenta: '#ab7df8',
    pink: '#db61a2',
    gray: '#6e7681',
  },
};

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexByte = (v: number) => Math.round(v).toString(16).padStart(2, '0');

function mix(a: string, b: string, t: number): string {
  const A = channels(a);
  const B = channels(b);
  return '#' + A.map((v, i) => hexByte(v + (B[i] - v) * t)).join('');
}

// APCA-W3 0.0.98G-4g lightness contrast, as a positive Lc for either polarity.
export function apcaContrast(text: string, background: string): number {
  const y = (hex: string) => {
    const [r, g, b] = channels(hex).map((v) => (v / 255) ** 2.4);
    const lum = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    return lum < 0.022 ? lum + (0.022 - lum) ** 1.414 : lum;
  };
  const yt = y(text);
  const yb = y(background);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb >= yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return s > -0.1 ? 0 : -(s + 0.027) * 100;
}

// Dark when white text reads better on it than black text.
export const isDarkColor = (hex: string) => apcaContrast(WHITE, hex) > apcaContrast(BLACK, hex);

const toLinear = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const toSrgb = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
};

function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    Math.hypot(A, B),
    Math.atan2(B, A),
  ];
}

// Out of the sRGB gamut, chroma drops until the color fits.
function fromOklch(L: number, C: number, H: number): string {
  for (let chroma = C; ; chroma *= 0.95) {
    const A = chroma * Math.cos(H);
    const B = chroma * Math.sin(H);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (chroma < 0.001 || rgb.every((x) => x >= -0.0005 && x <= 1.0005)) {
      return '#' + rgb.map((x) => hexByte(toSrgb(x) * 255)).join('');
    }
  }
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const lightnessOf = (hex: string) => toOklch(hex)[0];

// Steps the lightness toward `dir` (-1 darker, 1 lighter) until `ok` holds.
function shift(color: string, ok: (c: string) => boolean, dir: 1 | -1): string {
  const [L, C, H] = toOklch(color);
  for (let i = 0; i <= 200; i++) {
    const c = i ? fromOklch(clamp(L + dir * i * 0.005), C, H) : color;
    if (ok(c)) return c;
  }
  return dir < 0 ? BLACK : WHITE;
}

const readsOn = (min: number, backgrounds: string[]) => (c: string) =>
  backgrounds.every((b) => apcaContrast(c, b) >= min);

// The red is text on the surfaces and the fill under a white button label at once. It
// keeps its lightness if all read at 45, else takes the nearest lightness where they do.
function destructiveFor(red: string, surfaces: string[]): string {
  const both = (c: string) =>
    Math.min(...surfaces.map((s) => apcaContrast(c, s)), apcaContrast(WHITE, c));
  if (both(red) >= 45) return red;
  const [L, C, H] = toOklch(red);
  let best = red;
  for (let i = 1; i <= 200; i++) {
    for (const l of [L + i * 0.005, L - i * 0.005]) {
      const c = fromOklch(clamp(l), C, H);
      if (both(c) >= 45) return c;
      if (both(c) > both(best)) best = c;
    }
  }
  return best;
}

// The CSS custom properties of the theme, e.g. { '--background': '#101012' }.
export function customThemeVars({ accent, background, contrast }: CustomTheme) {
  const dark = isDarkColor(background);
  const status = dark ? STATUS.dark : STATUS.light;
  const dir = dark ? 1 : -1;
  const c = Math.max(0, Math.min(100, contrast)) / 100;
  // A mid-grey background leaves no room for text on the surfaces around it, so it
  // moves away from the text color until black or white text reads at Lc 97. Below that
  // a dark popover has no red that reads both on it and under a white label.
  let bg = shift(background, (x) => apcaContrast(dark ? WHITE : BLACK, x) >= 97, dark ? -1 : 1);
  // Cards are lighter than a light background, so a white one is toned down to make room.
  if (!dark) bg = shift(bg, (x) => lightnessOf(x) <= 0.985, -1);
  const ink = (t: number) => mix(bg, dark ? WHITE : BLACK, t);

  const sidebar = mix(bg, BLACK, dark ? 0.3 : 0.025);
  const column = mix(bg, BLACK, dark ? 0.2 : 0.045);
  const card = dark ? mix(bg, WHITE, 0.04) : mix(bg, WHITE, 0.6);
  const popover = dark ? mix(bg, WHITE, 0.06) : card;
  const secondary = ink(dark ? 0.08 : 0.04);
  const hover = ink(dark ? 0.1 : 0.055);
  const surfaces = [bg, card, popover, sidebar, column, secondary, hover];

  // The button label is white or near-black, whichever needs the smaller change to the
  // accent; the accent then moves away from it.
  const fillUnderWhite = shift(accent, (x) => apcaContrast(WHITE, x) >= 75, -1);
  const fillUnderInk = shift(accent, (x) => apcaContrast(INK, x) >= 75, 1);
  const moved = (fill: string) => Math.abs(lightnessOf(fill) - lightnessOf(accent));
  const [primaryFg, primary] =
    moved(fillUnderWhite) <= moved(fillUnderInk) ? [WHITE, fillUnderWhite] : [INK, fillUnderInk];

  const muted = shift(ink(0.5 + 0.25 * c), readsOn(75, surfaces), dir);
  const selected = mix(card, primary, dark ? 0.24 : 0.16);
  const blocked = mix(card, status.red, dark ? 0.1 : 0.06);
  const rowBlocked = mix(bg, status.red, 0.05);
  const rowBlockedHover = mix(bg, status.red, 0.09);
  const wipDestructive = mix(column, status.red, dark ? 0.1 : 0.07);
  const wipWarning = mix(column, status.yellow, dark ? 0.08 : 0.1);
  // The hover shades move toward the text, so they depend on it.
  const hoversFor = (fg: string) => {
    const cardHover = mix(card, fg, dark ? 0.06 : 0.04);
    return {
      cardHover,
      blockedHover: mix(cardHover, status.red, dark ? 0.1 : 0.06),
      sidebarAccent: mix(sidebar, fg, dark ? 0.08 : 0.07),
    };
  };
  const tints = [selected, blocked, rowBlocked, rowBlockedHover, wipDestructive, wipWarning];
  // Text reads on every surface and stays above the secondary text by Lc 10.
  let fg = ink(0.82 + 0.18 * c);
  for (let pass = 0; pass < 2; pass++) {
    const on = readsOn(75, [...surfaces, ...tints, ...Object.values(hoversFor(fg))]);
    fg = shift(fg, (x) => on(x) && apcaContrast(x, bg) >= apcaContrast(muted, bg) + 10, dir);
  }
  const { cardHover, blockedHover, sidebarAccent } = hoversFor(fg);

  const ring = shift(primary, readsOn(30, [bg]), dir);
  const destructive = destructiveFor(status.red, [bg, card, popover]);
  // The overdue badge, which globals.css mixes from the red and the card.
  const overdue = mix(card, destructive, dark ? 0.12 : 0.09);
  const priority = (color: string) => shift(color, readsOn(30, [card]), dir);
  // A hairline has no APCA floor; it sits at least this far past each surface it
  // crosses, toward the text, so it still shows on a popover.
  const hairline = (t: number, gap: number) =>
    shift(
      ink(t),
      (x) => [bg, card, popover].every((s) => (lightnessOf(x) - lightnessOf(s)) * dir >= gap),
      dir,
    );
  const border = hairline((dark ? 0.12 : 0.1) + 0.1 * c, 0.05);

  const tokens: Record<string, string> = {
    background: bg,
    foreground: fg,
    card,
    'card-foreground': fg,
    popover,
    'popover-foreground': fg,
    primary,
    'primary-foreground': primaryFg,
    secondary,
    'secondary-foreground': fg,
    muted: secondary,
    'muted-foreground': muted,
    accent: hover,
    'accent-foreground': fg,
    destructive,
    'destructive-text': shift(destructive, readsOn(60, [bg, card, wipDestructive, overdue]), dir),
    warning: shift(status.yellow, readsOn(60, [bg, card, column, wipWarning]), dir),
    border,
    input: hairline((dark ? 0.18 : 0.14) + 0.12 * c, 0.08),
    ring,
    'chart-1': status.blue,
    'chart-2': status.green,
    'chart-3': status.yellow,
    'chart-4': status.magenta,
    'chart-5': status.pink,
    sidebar,
    'sidebar-foreground': fg,
    'sidebar-primary': primary,
    'sidebar-primary-foreground': primaryFg,
    'sidebar-accent': sidebarAccent,
    'sidebar-accent-foreground': fg,
    'sidebar-border': border,
    'sidebar-ring': ring,
    'priority-low': priority(status.gray),
    'priority-medium': priority(status.yellow),
    'priority-high': priority(status.orange),
    'priority-urgent': priority(status.red),
    'kanban-column': column,
    'kanban-column-raised': mix(column, bg, 0.45),
    'kanban-column-wip-destructive': wipDestructive,
    'kanban-column-wip-warning': wipWarning,
    'kanban-card': card,
    'kanban-card-hover': cardHover,
    'kanban-card-blocked': blocked,
    'kanban-card-blocked-hover': blockedHover,
    'row-blocked': rowBlocked,
    'row-blocked-hover': rowBlockedHover,
    'kanban-card-selected': selected,
  };
  return Object.fromEntries(Object.entries(tokens).map(([k, v]) => [`--${k}`, v]));
}
