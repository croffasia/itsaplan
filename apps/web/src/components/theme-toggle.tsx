'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdateAccountPreferences } from '@/services/preferences.service';

// Toggles between the light and dark theme. The choice is saved to the account, the
// same as picking it in preferences, so it survives a new session and reaches other
// devices; PreferencesSync hands the stored value back to next-themes on load. The
// icon is rendered only after mount so the server and client markup match (the
// resolved theme is unknown during SSR).
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const update = useUpdateAccountPreferences();
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-8 shrink-0"
      title="Toggle theme"
      aria-label="Toggle theme"
      onClick={() => {
        const next = isDark ? 'light' : 'dark';
        setTheme(next);
        update.mutate({ theme: next });
      }}
    >
      {mounted && (isDark ? <Sun /> : <Moon />)}
    </Button>
  );
}
