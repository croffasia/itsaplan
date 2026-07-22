'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// App-wide toast host. Mounted once in Providers; toasts are raised by the global
// React Query mutation error handler and any explicit toast() call. Follows the
// app theme (light/dark) set by next-themes.
export function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();
  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
