'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { NotificationSettings } from '@/lib/api/endpoints/notificationSettings';
import { useUpdateNotificationSettings } from '@/services/teams.service';

export interface AppriseForm {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  url: string;
  setUrl: (v: string) => void;
  settings: NotificationSettings;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Form state for the Apprise notification provider tab. The URL is sent only when
// changed.
export function useAppriseForm(teamId: number, settings: NotificationSettings): AppriseForm {
  const t = useTranslations('teams.notifications');
  const update = useUpdateNotificationSettings(teamId);
  const [enabled, setEnabled] = useState(settings.apprise.enabled);
  const [url, setUrl] = useState('');

  const dirty = enabled !== settings.apprise.enabled || url.length > 0;

  async function save() {
    await update.mutateAsync({
      apprise: {
        enabled,
        ...(url.length > 0 ? { url } : {}),
      },
    });
    setUrl('');
    toast.success(t('appriseSaved'));
  }

  return { enabled, setEnabled, url, setUrl, settings, dirty, saving: update.isPending, save };
}
