import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  PALETTES,
  colorThemeCookieValue,
  customThemeFrom,
  formatCustomTheme,
  parseColorThemeCookie,
  parseCustomTheme,
} from './colorThemes';
import { apcaContrast, customThemeVars, isDarkColor, lightnessOf } from './customTheme';

describe('custom theme colors', () => {
  // Backgrounds and accents from both ends of the scale, including an accent that
  // matches the background and mid-grey that sits on the light/dark boundary.
  const backgrounds = ['#ffffff', '#000000', '#777777', '#101012', '#f6f2ee', '#3a0d4d'];
  const accents = ['#5e6ad2', '#ffff00', '#000000', '#ffffff', '#777777', '#e5484d'];

  // The APCA targets of DESIGN.md.
  it('keeps text, buttons and the focus ring readable on any colors', () => {
    for (const background of backgrounds)
      for (const accent of accents)
        for (const contrast of [0, 30, 100]) {
          const v = customThemeVars({ accent, background, contrast });
          const lc = (text: string, bg: string) => apcaContrast(v[text] ?? text, v[bg]);
          const at = `${accent} on ${background} at ${contrast}`;
          for (const surface of ['--background', '--sidebar', '--popover', '--kanban-column'])
            assert.ok(lc('--foreground', surface) >= 75, `${at}: text on ${surface}`);
          for (const surface of ['--card', '--muted', '--accent', '--kanban-column'])
            assert.ok(lc('--muted-foreground', surface) >= 75, `${at}: muted on ${surface}`);
          assert.ok(lc('--primary-foreground', '--primary') >= 75, `${at}: button label`);
          assert.ok(lc('--ring', '--background') >= 30, `${at}: focus ring`);
          for (const surface of ['--background', '--card', '--popover'])
            assert.ok(lc('--destructive', surface) >= 45, `${at}: red text on ${surface}`);
          assert.ok(lc('#ffffff', '--destructive') >= 45, `${at}: red button label`);
          for (const surface of ['--kanban-card', '--kanban-column-wip-destructive'])
            assert.ok(
              lc('--destructive-text', surface) >= 60,
              `${at}: small red text on ${surface}`,
            );
          assert.ok(lc('--warning', '--kanban-column-wip-warning') >= 60, `${at}: WIP warning`);
          assert.notEqual(v['--card'], v['--background'], `${at}: card on the page`);
          assert.notEqual(v['--kanban-card-hover'], v['--kanban-card'], `${at}: card hover`);
        }
  });

  it('takes light or dark from the background', () => {
    assert.equal(isDarkColor('#101012'), true);
    assert.equal(isDarkColor('#f6f2ee'), false);
  });
});

describe('highlights', () => {
  // A highlight and a surface it is drawn on, with the least OKLCH lightness between them.
  const highlights: [string, string, number][] = [
    ['--accent', '--popover', 0.04],
    ['--accent', '--card', 0.04],
    ['--accent', '--background', 0.03],
    ['--muted', '--popover', 0.025],
    ['--muted', '--card', 0.025],
    ['--sidebar-accent', '--sidebar', 0.03],
    ['--kanban-card-hover', '--kanban-card', 0.02],
  ];
  const lightness = (color: string) =>
    color.startsWith('#') ? lightnessOf(color) : Number(/^oklch\(([\d.]+)/.exec(color)![1]);
  const assertVisible = (tokens: Record<string, string>, at: string) => {
    for (const [highlight, surface, min] of highlights) {
      const gap = Math.abs(lightness(tokens[highlight]) - lightness(tokens[surface]));
      assert.ok(gap >= min, `${at}: ${highlight} on ${surface} is ${gap.toFixed(3)}`);
    }
  };

  it('show in every built-in palette', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    const tokensOf = (selector: string) => {
      const start = css.indexOf(`\n${selector} {`);
      assert.ok(start >= 0, `no ${selector} in globals.css`);
      const block = css.slice(start, css.indexOf('\n}', start));
      return Object.fromEntries(
        [...block.matchAll(/(--[\w-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]),
      );
    };
    for (const palette of PALETTES) {
      if (palette === 'custom') continue;
      const root = palette === 'default' ? ':root' : `:root[data-palette='${palette}']`;
      assertVisible(tokensOf(root), `${palette} light`);
      assertVisible(tokensOf(palette === 'default' ? '.dark' : `${root}.dark`), `${palette} dark`);
    }
  });

  it('show in a custom theme on any background', () => {
    for (const background of ['#ffffff', '#f6f2ee', '#777777', '#3a0d4d', '#2e3440', '#000000'])
      for (const contrast of [0, 100])
        assertVisible(
          customThemeVars({ accent: '#5e6ad2', background, contrast }),
          `${background} at ${contrast}`,
        );
  });
});

describe('custom theme text', () => {
  it('reads back what copy writes', () => {
    const theme = customThemeFrom('nord', true);
    assert.deepEqual(parseCustomTheme(formatCustomTheme(theme)), theme);
  });

  it('refuses anything that is not three valid values', () => {
    assert.equal(parseCustomTheme('not json'), null);
    assert.equal(parseCustomTheme('null'), null);
    assert.equal(parseCustomTheme('{"accent":"red;}","background":"#101012","contrast":30}'), null);
    assert.equal(
      parseCustomTheme('{"accent":"#5e6ad2","background":"#101012","contrast":101}'),
      null,
    );
  });
});

describe('color theme cookie', () => {
  it('round-trips a palette and a custom theme', () => {
    const custom = { accent: '#5e6ad2', background: '#101012', contrast: 30 };
    assert.deepEqual(parseColorThemeCookie(colorThemeCookieValue('nord', custom)), {
      palette: 'nord',
      custom: null,
    });
    assert.deepEqual(parseColorThemeCookie(colorThemeCookieValue('custom', custom)), {
      palette: 'custom',
      custom,
    });
  });

  it('falls back to the default palette for an unknown value', () => {
    for (const value of [undefined, '', 'custom', 'sepia', 'custom-zzzzzz-101012-30'])
      assert.deepEqual(parseColorThemeCookie(value), { palette: 'default', custom: null });
  });
});
