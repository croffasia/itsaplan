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
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
