'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { NotificationSettings } from '@/lib/api/endpoints/notificationSettings';
import { useUpdateNotificationSettings } from '@/services/teams.service';

export interface TelegramForm {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  botToken: string;
  setBotToken: (v: string) => void;
  settings: NotificationSettings;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Form state for the Telegram notification provider tab. Shared between the tab's
// Save button and the body fields, so it lives in a hook. The token is sent only when
// changed.
export function useTelegramForm(teamId: number, settings: NotificationSettings): TelegramForm {
  const t = useTranslations('teams.notifications');
  const update = useUpdateNotificationSettings(teamId);
  const [enabled, setEnabled] = useState(settings.telegram.enabled);
  const [botToken, setBotToken] = useState('');

  const dirty = enabled !== settings.telegram.enabled || botToken.length > 0;

  async function save() {
    await update.mutateAsync({
      telegram: {
        enabled,
        ...(botToken.length > 0 ? { botToken } : {}),
      },
    });
    setBotToken('');
    toast.success(t('telegramSaved'));
  }

  return {
    enabled,
    setEnabled,
    botToken,
    setBotToken,
    settings,
    dirty,
    saving: update.isPending,
    save,
  };
}
