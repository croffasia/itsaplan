import type { NotificationEncryption } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsCard from '@/components/common/page/SettingsCard';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import ProviderToggle from '@/components/common/inputs/ProviderToggle';
import SecretInput from '@/components/common/inputs/SecretInput';
import type { GodEmailForm } from '../../hooks/useGodEmailForm';

const ENCRYPTION_OPTIONS: { value: NotificationEncryption; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'ssl', label: 'SSL' },
  { value: 'tls', label: 'TLS' },
];

// The instance mail provider, one of SMTP or Resend. Everything the instance sends
// (password resets, address confirmation, sign-in links) goes through it, which is
// why the sign-in options on the Authentication page stay off until it is set.
export default function GodEmailSettings({ form }: { form: GodEmailForm }) {
  return (
    <div className="space-y-8">
      <ProviderSection form={form} />
      <SettingsSection
        title="Project notifications"
        description="Let projects deliver their notifications through this provider instead of configuring one of their own. Each project still chooses whether to use it."
        action={
          <EnabledSwitch
            checked={form.allowProjects}
            onChange={form.setAllowProjects}
            disabled={form.saving}
          />
        }
      />
    </div>
  );
}

function ProviderSection({ form }: { form: GodEmailForm }) {
  const { settings } = form;
  return (
    <SettingsSection
      title="Email provider"
      description="Choose one provider. Credentials are stored encrypted."
      action={
        <EnabledSwitch checked={form.enabled} onChange={form.setEnabled} disabled={form.saving} />
      }
    >
      <SettingsCard className="space-y-6 p-4">
        <ProviderToggle value={form.provider} onChange={form.setProvider} disabled={form.saving} />

        <div className="space-y-1.5 sm:max-w-md">
          <Label htmlFor="email-from">From address</Label>
          <Input
            id="email-from"
            value={form.from}
            onChange={(e) => form.setFrom(e.target.value)}
            placeholder={"It's a Plan <noreply@example.com>"}
          />
          <p className="text-xs text-muted-foreground">
            Required for Resend. With SMTP it defaults to the username.
          </p>
        </div>

        {form.provider === 'smtp' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-host">Host</Label>
              <Input
                id="smtp-host"
                value={form.host}
                onChange={(e) => form.setHost(e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                min={1}
                value={form.port}
                onChange={(e) => form.setPort(e.target.value)}
                placeholder="587"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-encryption">Encryption</Label>
              <Select
                value={form.encryption}
                onValueChange={(v) => form.setEncryption(v as NotificationEncryption)}
              >
                <SelectTrigger id="smtp-encryption" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENCRYPTION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-username">Username</Label>
              <Input
                id="smtp-username"
                value={form.username}
                onChange={(e) => form.setUsername(e.target.value)}
                placeholder="noreply@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-password">Password</Label>
              <SecretInput
                id="smtp-password"
                value={form.password}
                onChange={form.setPassword}
                hasStored={settings.smtp.hasPassword}
                editable
                placeholder="SMTP password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-timeout">Timeout (s)</Label>
              <Input
                id="smtp-timeout"
                type="number"
                min={1}
                value={form.timeout}
                onChange={(e) => form.setTimeout(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 sm:max-w-md">
            <Label htmlFor="resend-api-key">API key</Label>
            <SecretInput
              id="resend-api-key"
              value={form.apiKey}
              onChange={form.setApiKey}
              hasStored={settings.resend.hasApiKey}
              editable
              placeholder="re_…"
            />
          </div>
        )}
      </SettingsCard>
    </SettingsSection>
  );
}
