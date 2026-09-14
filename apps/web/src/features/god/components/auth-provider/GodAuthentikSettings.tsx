import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsCard from '@/components/common/page/SettingsCard';
import CopyableValue from '@/components/common/page/CopyableValue';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import SecretInput from '@/components/common/inputs/SecretInput';
import type { GodAuthentikForm } from '../../hooks/useGodAuthentikForm';

export default function GodAuthentikSettings({ form }: { form: GodAuthentikForm }) {
  const t = useTranslations('god.authProvider');

  return (
    <SettingsSection
      title={t('authentik')}
      description={t(form.hasCredentials ? 'authentikConfigured' : 'authentikMissing')}
      action={
        <EnabledSwitch
          checked={form.enabled}
          onChange={form.setEnabled}
          disabled={form.saving || !form.hasCredentials}
        />
      }
    >
      <SettingsCard className="space-y-6 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="authentik-discovery-url">{t('discoveryUrl')}</Label>
          <Input
            id="authentik-discovery-url"
            value={form.discoveryUrl}
            onChange={(event) => form.setDiscoveryUrl(event.target.value)}
            placeholder="https://auth.example.com/application/o/itsaplan/.well-known/openid-configuration"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">{t('authentikDiscoveryUrlHint')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="authentik-client-id">{t('clientId')}</Label>
            <Input
              id="authentik-client-id"
              value={form.clientId}
              onChange={(event) => form.setClientId(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="authentik-client-secret">{t('clientSecret')}</Label>
            <SecretInput
              id="authentik-client-secret"
              value={form.clientSecret}
              onChange={form.setClientSecret}
              hasStored={form.settings.hasClientSecret}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="authentik-scopes">{t('scopes')}</Label>
            <Input
              id="authentik-scopes"
              value={form.scopes}
              onChange={(event) => form.setScopes(event.target.value)}
              placeholder="openid profile email"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t('scopesHint')}</p>
          </div>
        </div>

        <CopyableValue
          title={t('redirectUri')}
          value={form.settings.redirectUri}
          hint={t('authentikRedirectUriHint')}
          copyLabel={t('copyRedirectUri')}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
