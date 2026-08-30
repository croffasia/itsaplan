import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsCard from '@/components/common/page/SettingsCard';
import CopyableValue from '@/components/common/page/CopyableValue';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import SecretInput from '@/components/common/inputs/SecretInput';
import type { GodGoogleForm } from '../../hooks/useGodGoogleForm';

// The Google OAuth credentials from the Google Cloud console. The
// redirect URI is derived from the API origin and shown read-only, since it has to be
// registered on the OAuth client for the round trip to work at all.
export default function GodGoogleSettings({ form }: { form: GodGoogleForm }) {
  const t = useTranslations('god.authProvider');

  return (
    <SettingsSection
      title={t('google')}
      description={t(form.hasCredentials ? 'googleConfigured' : 'googleMissing')}
      action={
        <EnabledSwitch
          checked={form.enabled}
          onChange={form.setEnabled}
          disabled={form.saving || !form.hasCredentials}
        />
      }
    >
      <SettingsCard className="space-y-6 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="google-client-id">{t('clientId')}</Label>
            <Input
              id="google-client-id"
              value={form.clientId}
              onChange={(e) => form.setClientId(e.target.value)}
              placeholder="…apps.googleusercontent.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="google-client-secret">{t('clientSecret')}</Label>
            <SecretInput
              id="google-client-secret"
              value={form.clientSecret}
              onChange={form.setClientSecret}
              hasStored={form.settings.hasClientSecret}
              editable
              placeholder="GOCSPX-…"
            />
          </div>
        </div>

        <CopyableValue
          title={t('redirectUri')}
          value={form.settings.redirectUri}
          hint={t('redirectUriHint')}
          copyLabel={t('copyRedirectUri')}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
