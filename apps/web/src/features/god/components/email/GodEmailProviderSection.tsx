import { useTranslations } from 'next-intl';
import type { NotificationEncryption } from '@/lib/api/endpoints/notificationSettings';
import type { SmtpAuth } from '@/lib/api/endpoints/god';
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
import GodEmailTestButton from './GodEmailTestButton';

const ENCRYPTION_OPTIONS: NotificationEncryption[] = ['none', 'ssl', 'tls'];
const AUTH_OPTIONS: SmtpAuth[] = ['password', 'microsoft365'];

export default function GodEmailProviderSection({ form }: { form: GodEmailForm }) {
  const t = useTranslations('god.email');
  const { settings } = form;

  return (
    <SettingsSection
      title={t('provider')}
      description={t('providerHint')}
      action={
        <EnabledSwitch checked={form.enabled} onChange={form.setEnabled} disabled={form.saving} />
      }
    >
      <SettingsCard className="space-y-6 p-4">
        <ProviderToggle value={form.provider} onChange={form.setProvider} disabled={form.saving} />

        <div className="space-y-1.5 sm:max-w-md">
          <Label htmlFor="email-from">{t('from')}</Label>
          <Input
            id="email-from"
            value={form.from}
            onChange={(e) => form.setFrom(e.target.value)}
            placeholder={'One Health <noreply@example.com>'}
          />
          <p className="text-xs text-muted-foreground">{t('fromHint')}</p>
        </div>

        {form.provider === 'smtp' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-host">{t('host')}</Label>
              <Input
                id="smtp-host"
                value={form.host}
                onChange={(e) => form.setHost(e.target.value)}
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
                placeholder="587"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-encryption">{t('encryption')}</Label>
              <Select
                value={form.encryption}
                onValueChange={(v) => form.setEncryption(v as NotificationEncryption)}
              >
                <SelectTrigger id="smtp-encryption" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENCRYPTION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`encryptionOptions.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-auth">{t('smtpAuth')}</Label>
              <Select value={form.smtpAuth} onValueChange={(v) => form.setSmtpAuth(v as SmtpAuth)}>
                <SelectTrigger id="smtp-auth" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`smtpAuthOptions.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-username">
                {t(form.smtpAuth === 'microsoft365' ? 'mailbox' : 'username')}
              </Label>
              <Input
                id="smtp-username"
                value={form.username}
                onChange={(e) => form.setUsername(e.target.value)}
                placeholder="noreply@example.com"
                autoComplete="off"
              />
            </div>
            {form.smtpAuth === 'microsoft365' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-tenant">{t('tenantId')}</Label>
                  <Input
                    id="smtp-tenant"
                    value={form.tenantId}
                    onChange={(e) => form.setTenantId(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-client">{t('clientId')}</Label>
                  <Input
                    id="smtp-client"
                    value={form.clientId}
                    onChange={(e) => form.setClientId(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-client-secret">{t('clientSecret')}</Label>
                  <SecretInput
                    id="smtp-client-secret"
                    value={form.clientSecret}
                    onChange={form.setClientSecret}
                    hasStored={settings.smtp.oauth.hasClientSecret}
                    placeholder={t('clientSecretPlaceholder')}
                  />
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-3">
                  {t('microsoft365Hint')}
                </p>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="smtp-password">{t('password')}</Label>
                <SecretInput
                  id="smtp-password"
                  value={form.password}
                  onChange={form.setPassword}
                  hasStored={settings.smtp.hasPassword}
                  placeholder={t('passwordPlaceholder')}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="smtp-timeout">{t('timeout')}</Label>
              <Input
                id="smtp-timeout"
                type="number"
                min={1}
                value={form.timeout}
                onChange={(e) => form.setTimeout(e.target.value)}
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
              placeholder="re_…"
            />
          </div>
        )}

        <GodEmailTestButton form={form} />
      </SettingsCard>
    </SettingsSection>
  );
}
