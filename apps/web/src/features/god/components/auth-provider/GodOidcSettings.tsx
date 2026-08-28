import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsCard from '@/components/common/page/SettingsCard';
import CopyableValue from '@/components/common/page/CopyableValue';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import SecretInput from '@/components/common/inputs/SecretInput';
import type { GodOidcForm } from '../../hooks/useGodOidcForm';

// The instance's own OIDC provider: any server that publishes a well-known document
// (Keycloak, Authentik, KanIDM, GitLab, Forgejo). The authorization, token and
// userinfo endpoints are read from that document, so none of them is entered here.
export default function GodOidcSettings({ form }: { form: GodOidcForm }) {
  const t = useTranslations('god.authProvider');

  return (
    <SettingsSection
      title={t('oidc')}
      description={t(form.hasCredentials ? 'oidcConfigured' : 'oidcMissing')}
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
          <Label htmlFor="oidc-discovery-url">{t('discoveryUrl')}</Label>
          <Input
            id="oidc-discovery-url"
            value={form.discoveryUrl}
            onChange={(e) => form.setDiscoveryUrl(e.target.value)}
            placeholder="https://idp.example.com/.well-known/openid-configuration"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">{t('discoveryUrlHint')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="oidc-client-id">{t('clientId')}</Label>
            <Input
              id="oidc-client-id"
              value={form.clientId}
              onChange={(e) => form.setClientId(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oidc-client-secret">{t('clientSecret')}</Label>
            <SecretInput
              id="oidc-client-secret"
              value={form.clientSecret}
              onChange={form.setClientSecret}
              hasStored={form.settings.hasClientSecret}
              editable
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oidc-label">{t('oidcLabel')}</Label>
            <Input
              id="oidc-label"
              value={form.label}
              onChange={(e) => form.setLabel(e.target.value)}
              placeholder={t('oidcLabelPlaceholder')}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">{t('oidcLabelHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oidc-scopes">{t('scopes')}</Label>
            <Input
              id="oidc-scopes"
              value={form.scopes}
              onChange={(e) => form.setScopes(e.target.value)}
              placeholder="openid profile email"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t('scopesHint')}</p>
          </div>
        </div>

        <CopyableValue
          title={t('redirectUri')}
          value={form.settings.redirectUri}
          hint={t('oidcRedirectUriHint')}
          copyLabel={t('copyRedirectUri')}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
