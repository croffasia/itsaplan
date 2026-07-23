import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: "It's a Plan: issue tracking for people and agents",
  description:
    'A self-hosted, open-source issue tracker with AI agents built in. Assign work to people or agents, and drive it through the API, webhooks and MCP.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
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
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
