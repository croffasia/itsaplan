'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { InstanceAuthSettings } from '@/lib/api';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import GodSectionPage from '../GodSectionPage';
import RegistrationModePicker from './RegistrationModePicker';
import { useGodPolicyForm } from '../../hooks/useGodPolicyForm';

// The registration policy and the sign-in options. The provider credentials live
// under Integrations (Email provider, Auth provider).
export default function GodAuthenticationForm({
  authSettings,
}: {
  authSettings: InstanceAuthSettings;
}) {
  const t = useTranslations('god.authentication');
  const tCommon = useTranslations('common');
  const policy = useGodPolicyForm(authSettings);

  // The options that send mail need a configured provider; the API rejects them
  // without one.
  const needsProvider = !authSettings.hasEmailProvider;
  // Turning the password form off needs another way in, or nobody could sign in at
  // all. The API rejects it, and the switch says why before anyone tries.
  const needsSso = !authSettings.hasSsoProvider;

  async function save() {
    try {
      await policy.save();
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="authentication"
      actions={
        <Button size="sm" onClick={() => void save()} disabled={!policy.dirty || policy.saving}>
          {policy.saving ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <div className="space-y-10">
        <SettingsSection title={t('registration')} description={t('registrationHint')}>
          <SettingsCard className="divide-y divide-border/60">
            <RegistrationModePicker
              value={policy.registration}
              disabled={policy.saving}
              onChange={policy.setRegistration}
            />
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t('signIn')} description={t('signInHint')}>
          <SettingsCard className="divide-y divide-border/60">
            <SettingsRow
              title={t('emailPassword')}
              description={t('emailPasswordHint')}
              note={needsSso ? t('needsSso') : undefined}
              control={
                <Switch
                  checked={policy.emailPassword}
                  disabled={policy.saving || (needsSso && policy.emailPassword)}
                  onCheckedChange={policy.setEmailPassword}
                />
              }
            />
            <SettingsRow
              title={t('requireVerification')}
              description={t('requireVerificationHint')}
              note={needsProvider ? t('needsProvider') : undefined}
              control={
                <Switch
                  checked={policy.requireEmailVerification}
                  disabled={policy.saving || needsProvider}
                  onCheckedChange={policy.setRequireEmailVerification}
                />
              }
            />
            <SettingsRow
              title={t('magicLink')}
              description={t('magicLinkHint')}
              note={needsProvider ? t('needsProvider') : undefined}
              control={
                <Switch
                  checked={policy.magicLink}
                  disabled={policy.saving || needsProvider}
                  onCheckedChange={policy.setMagicLink}
                />
              }
            />
          </SettingsCard>
        </SettingsSection>
      </div>
    </GodSectionPage>
  );
}
