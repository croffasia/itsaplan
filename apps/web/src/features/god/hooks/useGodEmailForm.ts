'use client';

import { useState } from 'react';
import type { NotificationEncryption, InstanceEmailSettings } from '@/lib/api';
import type { EmailProvider } from '@/components/common/inputs/ProviderToggle';
import { toPositiveInt } from '@/lib/utils';
import { useUpdateInstanceEmailSettings } from '../services/god.service';

export interface GodEmailForm {
  provider: EmailProvider;
  setProvider: (v: EmailProvider) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  from: string;
  setFrom: (v: string) => void;
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
  allowProjects: boolean;
  setAllowProjects: (v: boolean) => void;
  settings: InstanceEmailSettings;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// Form state for the instance mail provider (SMTP or Resend). Shared between the
// header Save button and the page body, so it lives in a hook. Secrets start blank and
// are sent only when changed. The whole tab saves at once.
//
// Unlike a project's notification provider this one also carries a From address:
// authentication mail is sent by the instance, so it has no project address to fall
// back on.
export function useGodEmailForm(settings: InstanceEmailSettings): GodEmailForm {
  const update = useUpdateInstanceEmailSettings();

  const initialProvider: EmailProvider = settings.resend.enabled ? 'resend' : 'smtp';
  const initialEnabled = settings.smtp.enabled || settings.resend.enabled;
  const initialPort = settings.smtp.port == null ? '' : String(settings.smtp.port);
  const initialTimeout = settings.smtp.timeout == null ? '' : String(settings.smtp.timeout);

  const [provider, setProvider] = useState<EmailProvider>(initialProvider);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [from, setFrom] = useState(settings.from);
  const [host, setHost] = useState(settings.smtp.host);
  const [port, setPort] = useState(initialPort);
  const [encryption, setEncryption] = useState<NotificationEncryption>(settings.smtp.encryption);
  const [username, setUsername] = useState(settings.smtp.username);
  const [password, setPassword] = useState('');
  const [timeout, setTimeout] = useState(initialTimeout);
  const [apiKey, setApiKey] = useState('');
  const [allowProjects, setAllowProjects] = useState(settings.allowProjects);

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
    from !== settings.from ||
    allowProjects !== settings.allowProjects ||
    (provider === 'smtp' ? smtpDirty : apiKey.length > 0);

  async function save() {
    await update.mutateAsync({
      from: from.trim(),
      allowProjects,
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
  }

  return {
    provider,
    setProvider,
    enabled,
    setEnabled,
    from,
    setFrom,
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
    allowProjects,
    setAllowProjects,
    settings,
    dirty,
    saving: update.isPending,
    save,
  };
}
