import type { CSSProperties } from 'react';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { ThemeProvider } from 'next-themes';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { AfterSignIn } from '@/cloud';
import { Providers } from '@/components/providers';
import RuntimeEnvScript from '@/components/runtime-env-script';
import Onboarding from '@/features/onboarding/Onboarding';
import WhatsNew from '@/features/whats-new/WhatsNew';
import { localeDirection, type Locale } from '@/i18n/locales';
import { APP_NAME } from '@/utils/app';
import { COLOR_THEME_COOKIE, parseColorThemeCookie } from '@/utils/colorThemes';
import { customThemeVars } from '@/utils/customTheme';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: APP_NAME,
    description: t('description'),
    appleWebApp: { title: APP_NAME, capable: true, statusBarStyle: 'default' },
  };
}

// The `--background` of each theme in globals.css, so the browser chrome of an
// installed app matches the page.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#131313' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const { palette, custom } = parseColorThemeCookie(
    (await cookies()).get(COLOR_THEME_COOKIE)?.value,
  );

  return (
    <html
      lang={locale}
      dir={localeDirection(locale as Locale)}
      data-palette={palette === 'default' ? undefined : palette}
      style={custom ? (customThemeVars(custom) as CSSProperties) : undefined}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <RuntimeEnvScript />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          // A distinct key: next-themes defaults to "theme", which collides with any
          // other app sharing the same localhost origin. A shared key makes two such
          // apps fight over the value through cross-tab storage events.
          storageKey="itsaplan-theme"
        >
          <NextIntlClientProvider>
            <Providers>
              {children}
              <Onboarding />
              <WhatsNew />
              <AfterSignIn />
            </Providers>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
