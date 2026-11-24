'use client';

import { BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  canShowFromPage,
  setDesktopNotifications,
  setDesktopNotificationsAnswered,
  useDesktopNotificationsAnswered,
  useDesktopNotificationsState,
} from '@/hooks/useDesktopNotifications';

// A strip under the top bar that offers desktop notifications while they are off and the
// browser can still allow them, until this browser answers. The server render counts as
// answered, so the probe below runs in the browser only.
export default function DesktopNotificationsPrompt() {
  const t = useTranslations('shell.desktopNotifications');
  const state = useDesktopNotificationsState();
  const answered = useDesktopNotificationsAnswered();
  if (state !== 'off' || answered || !canShowFromPage()) return null;

  return (
    <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-1 text-sm">
      <BellRing className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">{t('message')}</p>
      <Button
        size="sm"
        className="h-7"
        // Called straight from the click: a browser asks for the permission only on a
        // user gesture.
        onClick={() => void setDesktopNotifications(true)}
      >
        {t('turnOn')}
      </Button>
      <Button size="sm" variant="ghost" className="h-7" onClick={setDesktopNotificationsAnswered}>
        {t('notNow')}
      </Button>
    </div>
  );
}
