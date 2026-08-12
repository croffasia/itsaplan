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
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import ProviderToggle from '@/components/common/inputs/ProviderToggle';
import SecretInput from '@/components/common/inputs/SecretInput';
import type { EmailForm } from '../../hooks/useEmailForm';
import { useTranslations } from 'next-intl';

const ENCRYPTION_OPTIONS: NotificationEncryption[] = ['none', 'ssl', 'tls'];

// The instance provider or one of the project's own (SMTP or Resend). Non-secret
// fields prefill from the stored config; secrets start blank and are sent only when
// changed.
export default function EmailSettings({ form }: { form: EmailForm }) {
  const t = useTranslations('settings.notifications');
  const { settings, editable } = form;
  return (
    <SettingsSection
      title={t('emailProvider')}
      description={t('emailProviderHint')}
      action={
        editable && (
          <EnabledSwitch checked={form.enabled} onChange={form.setEnabled} disabled={!editable} />
        )
      }
    >
      <ProviderToggle
        value={form.provider}
        onChange={form.setProvider}
        options={['system', 'smtp', 'resend']}
        disabled={!editable}
      />

      {form.provider === 'system' ? (
        <p className="text-sm text-muted-foreground">
          {settings.systemAvailable ? t('systemAvailable') : t('systemUnavailable')}
        </p>
      ) : form.provider === 'smtp' ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="smtp-host">{t('host')}</Label>
            <Input
              id="smtp-host"
              value={form.host}
              onChange={(e) => form.setHost(e.target.value)}
              disabled={!editable}
              placeholder="smtp.example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-port">{t('port')}</Label>
            <Input
              id="smtp-port"
              type="number"
              min={1}
              value={form.port}
              onChange={(e) => form.setPort(e.target.value)}
              disabled={!editable}
              placeholder="587"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-encryption">{t('encryption')}</Label>
            <Select
              value={form.encryption}
              onValueChange={(v) => form.setEncryption(v as NotificationEncryption)}
              disabled={!editable}
            >
              <SelectTrigger id="smtp-encryption" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENCRYPTION_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {t(`encryptionOptions.${o}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-username">{t('username')}</Label>
            <Input
              id="smtp-username"
              value={form.username}
              onChange={(e) => form.setUsername(e.target.value)}
              disabled={!editable}
              placeholder="notifications@example.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-password">{t('password')}</Label>
            <SecretInput
              id="smtp-password"
              value={form.password}
              onChange={form.setPassword}
              hasStored={settings.smtp.hasPassword}
              editable={editable}
              placeholder={t('passwordPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-timeout">{t('timeout')}</Label>
            <Input
              id="smtp-timeout"
              type="number"
              min={1}
              value={form.timeout}
              onChange={(e) => form.setTimeout(e.target.value)}
              disabled={!editable}
              placeholder={t('optional')}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 sm:max-w-md">
          <Label htmlFor="resend-api-key">{t('apiKey')}</Label>
          <SecretInput
            id="resend-api-key"
            value={form.apiKey}
            onChange={form.setApiKey}
            hasStored={settings.resend.hasApiKey}
            editable={editable}
            placeholder="re_…"
          />
        </div>
      )}
    </SettingsSection>
  );
}
