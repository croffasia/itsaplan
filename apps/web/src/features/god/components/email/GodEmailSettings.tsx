import { useTranslations } from 'next-intl';
import SettingsSection from '@/components/common/page/SettingsSection';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import type { GodEmailForm } from '../../hooks/useGodEmailForm';
import GodEmailProviderSection from './GodEmailProviderSection';

// The instance mail provider, one of SMTP or Resend. Everything the instance sends
// (password resets, address confirmation, sign-in links) goes through it, which is
// why the sign-in options on the Authentication page stay off until it is set.
export default function GodEmailSettings({ form }: { form: GodEmailForm }) {
  const t = useTranslations('god.email');

  return (
    <div className="space-y-8">
      <GodEmailProviderSection form={form} />
      <SettingsSection
        title={t('projectNotifications')}
        description={t('projectNotificationsHint')}
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
