'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { NotificationSettings } from '@/lib/api';
import { useUpdateNotificationSettings } from '../services/settings.service';

export interface TelegramForm {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  botToken: string;
  setBotToken: (v: string) => void;
  settings: NotificationSettings;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Form state for the Telegram notification provider tab. Shared between the header
// Save button and the body fields, so it lives in a hook. The token is sent only
// when changed.
export function useTelegramForm(
  projectKey: string,
  settings: NotificationSettings,
  editable: boolean,
): TelegramForm {
  const update = useUpdateNotificationSettings(projectKey);
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
    toast.success('Telegram provider saved');
  }

  return {
    enabled,
    setEnabled,
    botToken,
    setBotToken,
    settings,
    editable,
    dirty,
    saving: update.isPending,
    save,
  };
}
