import { Label } from '@/components/ui/label';
import SettingsSection from '@/components/common/page/SettingsSection';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import SecretInput from '@/components/common/inputs/SecretInput';
import type { AppriseForm } from '../../hooks/useAppriseForm';
import { useTranslations } from 'next-intl';

// The Apprise API notify endpoint the team delivers through. Members choose which
// events they receive in their preferences; each message is tagged with the member's
// user id. The URL can carry a config key, so it is sent only when changed.
export default function AppriseSettings({ form }: { form: AppriseForm }) {
  const t = useTranslations('teams.notifications');
  const { settings } = form;
  return (
    <SettingsSection
      title={t('apprise')}
      description={t('appriseHint')}
      action={<EnabledSwitch checked={form.enabled} onChange={form.setEnabled} />}
    >
      <div className="space-y-1.5 sm:max-w-md">
        <Label htmlFor="apprise-url">{t('appriseUrl')}</Label>
        <SecretInput
          id="apprise-url"
          value={form.url}
          onChange={form.setUrl}
          hasStored={settings.apprise.hasUrl}
          placeholder="https://apprise.example.com/notify/your-key"
        />
      </div>
    </SettingsSection>
  );
}
