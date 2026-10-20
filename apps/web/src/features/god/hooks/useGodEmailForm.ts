'use client';

import { useState } from 'react';
import type {
  InstanceEmailSettings,
  InstanceEmailSettingsPatch,
  SmtpAuth,
} from '@/lib/api/endpoints/god';
import type { NotificationEncryption } from '@/lib/api/endpoints/notificationSettings';
import type { EmailProvider } from '@/components/common/inputs/ProviderToggle';
import { toPositiveInt } from '@/lib/utils';
import {
  useTestInstanceEmailSettings,
  useUpdateInstanceEmailSettings,
} from '../services/god.service';

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
  smtpAuth: SmtpAuth;
  setSmtpAuth: (v: SmtpAuth) => void;
  tenantId: string;
  setTenantId: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  clientSecret: string;
  setClientSecret: (v: string) => void;
  timeout: string;
  setTimeout: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  allowProjects: boolean;
  setAllowProjects: (v: boolean) => void;
  settings: InstanceEmailSettings;
  dirty: boolean;
  saving: boolean;
  testable: boolean;
  testing: boolean;
  save: () => Promise<void>;
  test: () => Promise<string>;
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
  const testEmail = useTestInstanceEmailSettings();

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
  const [smtpAuth, setSmtpAuthState] = useState<SmtpAuth>(settings.smtp.auth);
  const [tenantId, setTenantId] = useState(settings.smtp.oauth.tenantId);
  const [clientId, setClientId] = useState(settings.smtp.oauth.clientId);
  const [clientSecret, setClientSecret] = useState('');
  const [timeout, setTimeout] = useState(initialTimeout);
  const [apiKey, setApiKey] = useState('');
  const [allowProjects, setAllowProjects] = useState(settings.allowProjects);

  const smtpDirty =
    host !== settings.smtp.host ||
    port !== initialPort ||
    encryption !== settings.smtp.encryption ||
    username !== settings.smtp.username ||
    timeout !== initialTimeout ||
    password.length > 0 ||
    smtpAuth !== settings.smtp.auth ||
    tenantId !== settings.smtp.oauth.tenantId ||
    clientId !== settings.smtp.oauth.clientId ||
    clientSecret.length > 0;
  const smtpCredentialsReady =
    smtpAuth === 'microsoft365'
      ? username.trim().length > 0 &&
        tenantId.trim().length > 0 &&
        clientId.trim().length > 0 &&
        (clientSecret.length > 0 || settings.smtp.oauth.hasClientSecret)
      : username.trim().length === 0 || password.length > 0 || settings.smtp.hasPassword;
  const dirty =
    provider !== initialProvider ||
    enabled !== initialEnabled ||
    from !== settings.from ||
    allowProjects !== settings.allowProjects ||
    (provider === 'smtp' ? smtpDirty : apiKey.length > 0);
  const testable =
    enabled &&
    (provider === 'smtp'
      ? host.trim().length > 0 &&
        smtpCredentialsReady &&
        (from.trim().length > 0 || username.trim().length > 0)
      : (apiKey.length > 0 || settings.resend.hasApiKey) && from.trim().length > 0);

  function currentPatch(): InstanceEmailSettingsPatch {
    return {
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
        auth: smtpAuth,
        oauth: {
          tenantId: tenantId.trim(),
          clientId: clientId.trim(),
          ...(clientSecret.length > 0 ? { clientSecret } : {}),
        },
      },
      resend: {
        enabled: provider === 'resend' && enabled,
        ...(apiKey.length > 0 ? { apiKey } : {}),
      },
    };
  }

  // Microsoft 365 only accepts OAuth on its own endpoint, so an empty server is filled
  // with it rather than left for the owner to look up.
  function setSmtpAuth(next: SmtpAuth) {
    setSmtpAuthState(next);
    if (next === 'microsoft365' && host.trim().length === 0) {
      setHost('smtp.office365.com');
      setPort('587');
      setEncryption('tls');
    }
  }

  async function save() {
    await update.mutateAsync(currentPatch());
    setPassword('');
    setClientSecret('');
    setApiKey('');
  }

  async function test() {
    const result = await testEmail.mutateAsync(currentPatch());
    return result.recipient;
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
    smtpAuth,
    setSmtpAuth,
    tenantId,
    setTenantId,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    timeout,
    setTimeout,
    apiKey,
    setApiKey,
    allowProjects,
    setAllowProjects,
    settings,
    dirty,
    saving: update.isPending,
    testable,
    testing: testEmail.isPending,
    save,
    test,
  };
}
