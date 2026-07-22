'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { NotificationEncryption, NotificationSettings } from '@/lib/api';
import { useUpdateNotificationSettings } from '../services/settings.service';
import type { EmailProvider } from '@/components/common/inputs/ProviderToggle';
import { toPositiveInt } from '@/lib/utils';

export interface EmailForm {
  provider: EmailProvider;
  setProvider: (v: EmailProvider) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  host: string;
  setHost: (v: string) => void;
  port: string;
  setPort: (v: string) => void;
  encryption: NotificationEncryption;
  setEncryption: (v: NotificationEncryption) => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  timeout: string;
  setTimeout: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  settings: NotificationSettings;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Form state for the Email notification provider tab (SMTP or Resend). Shared
// between the header Save button and the body fields, so it lives in a hook. Secrets
// start blank and are sent only when changed. The whole tab saves at once.
export function useEmailForm(
  projectKey: string,
  settings: NotificationSettings,
  editable: boolean,
): EmailForm {
  const update = useUpdateNotificationSettings(projectKey);

  // The project's own provider wins when it configured one; otherwise it sends
  // through the instance provider, which is also the default for a new project.
  const initialProvider: EmailProvider = settings.smtp.enabled
    ? 'smtp'
    : settings.resend.enabled
      ? 'resend'
      : 'system';
  const initialEnabled =
    settings.smtp.enabled || settings.resend.enabled || settings.system.enabled;
  const initialPort = settings.smtp.port == null ? '' : String(settings.smtp.port);
  const initialTimeout = settings.smtp.timeout == null ? '' : String(settings.smtp.timeout);

  const [provider, setProvider] = useState<EmailProvider>(initialProvider);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [host, setHost] = useState(settings.smtp.host);
  const [port, setPort] = useState(initialPort);
  const [encryption, setEncryption] = useState<NotificationEncryption>(settings.smtp.encryption);
  const [username, setUsername] = useState(settings.smtp.username);
  const [password, setPassword] = useState('');
  const [timeout, setTimeout] = useState(initialTimeout);
  const [apiKey, setApiKey] = useState('');

  const smtpDirty =
    host !== settings.smtp.host ||
    port !== initialPort ||
    encryption !== settings.smtp.encryption ||
    username !== settings.smtp.username ||
    timeout !== initialTimeout ||
    password.length > 0;
  const dirty =
    provider !== initialProvider ||
    enabled !== initialEnabled ||
    (provider === 'smtp' ? smtpDirty : provider === 'resend' ? apiKey.length > 0 : false);

  async function save() {
    await update.mutateAsync({
      system: { enabled: provider === 'system' && enabled },
      smtp: {
        enabled: provider === 'smtp' && enabled,
        host: host.trim(),
        port: toPositiveInt(port),
        encryption,
        username: username.trim(),
        ...(password.length > 0 ? { password } : {}),
        timeout: toPositiveInt(timeout),
      },
      resend: {
        enabled: provider === 'resend' && enabled,
        ...(apiKey.length > 0 ? { apiKey } : {}),
      },
    });
    setPassword('');
    setApiKey('');
    toast.success('Email provider saved');
  }

  return {
    provider,
    setProvider,
    enabled,
    setEnabled,
    host,
    setHost,
    port,
    setPort,
    encryption,
    setEncryption,
    username,
    setUsername,
    password,
    setPassword,
    timeout,
    setTimeout,
    apiKey,
    setApiKey,
    settings,
    editable,
    dirty,
    saving: update.isPending,
    save,
  };
}
