'use client';

import { useEffect, useState } from 'react';
import type { MailboxSettings, MailboxSmtpSecurity } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SecretInput from '@/components/common/inputs/SecretInput';
import { useConnectMailbox } from '../services/mailbox.service';

export default function MailboxSettingsForm({
  projectKey,
  settings,
  onConnected,
}: {
  projectKey: string;
  settings: MailboxSettings;
  onConnected?: () => void;
}) {
  const connect = useConnectMailbox(projectKey);
  const [email, setEmail] = useState(settings.email);
  const [username, setUsername] = useState(settings.username);
  const [password, setPassword] = useState('');
  const [imapHost, setImapHost] = useState(settings.imapHost);
  const [smtpHost, setSmtpHost] = useState(settings.smtpHost);
  const [smtpPort, setSmtpPort] = useState<465 | 587>(settings.smtpPort);

  useEffect(() => {
    setEmail(settings.email);
    setUsername(settings.username);
    setImapHost(settings.imapHost);
    setSmtpHost(settings.smtpHost);
    setSmtpPort(settings.smtpPort);
    setPassword('');
  }, [settings]);

  const smtpSecurity: MailboxSmtpSecurity = smtpPort === 465 ? 'ssl' : 'starttls';
  const valid = Boolean(
    email.trim() &&
    username.trim() &&
    imapHost.trim() &&
    smtpHost.trim() &&
    (settings.hasPassword || password.length > 0),
  );

  let submitLabel = 'Connect mailbox';
  if (connect.isPending) submitLabel = 'Testing connection…';
  else if (settings.connected) submitLabel = 'Save connection';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await connect.mutateAsync({
      email,
      username,
      password: password || undefined,
      imapHost,
      smtpHost,
      smtpPort,
      smtpSecurity,
    });
    onConnected?.();
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mailbox-email">Email address</Label>
          <Input
            id="mailbox-email"
            type="email"
            value={email}
            onChange={(event) => {
              const nextEmail = event.target.value;
              setUsername((current) => (!current || current === email ? nextEmail : current));
              setEmail(nextEmail);
            }}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mailbox-username">Zoho username</Label>
          <Input
            id="mailbox-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="you@company.com"
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mailbox-password">Zoho application password</Label>
          <SecretInput
            id="mailbox-password"
            value={password}
            onChange={setPassword}
            hasStored={settings.hasPassword}
            editable
            placeholder="Application-specific password"
          />
          <p className="text-xs text-muted-foreground">
            Use an application-specific password when two-factor authentication is enabled.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mailbox-imap-host">IMAP server</Label>
          <Input
            id="mailbox-imap-host"
            value={imapHost}
            onChange={(event) => setImapHost(event.target.value)}
            placeholder="imappro.zoho.com"
            autoComplete="off"
            required
          />
          <p className="text-xs text-muted-foreground">Port 993 · SSL/TLS</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mailbox-smtp-host">SMTP server</Label>
          <Input
            id="mailbox-smtp-host"
            value={smtpHost}
            onChange={(event) => setSmtpHost(event.target.value)}
            placeholder="smtppro.zoho.com"
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mailbox-smtp-port">SMTP security</Label>
          <Select
            value={String(smtpPort)}
            onValueChange={(value) => setSmtpPort(value === '587' ? 587 : 465)}
          >
            <SelectTrigger id="mailbox-smtp-port" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="465">SSL · port 465</SelectItem>
              <SelectItem value="587">STARTTLS · port 587</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={!valid || connect.isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
