import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Switch } from '@/components/ui/switch';
import type { GodSamlForm } from '../../hooks/useGodSamlForm';

// The password switch of the authentication settings, seen from here. Turning it on needs
// a usable provider, or nobody could sign in; the API refuses it otherwise.
export default function GodSsoOnlySetting({
  form,
  available,
}: {
  form: GodSamlForm;
  available: boolean;
}) {
  const t = useTranslations('god.authProvider');

  return (
    <SettingsCard className="mt-4">
      <SettingsRow
        title={t('ssoOnly')}
        description={t('ssoOnlyHint')}
        note={available ? undefined : t('ssoOnlyNeedsProvider')}
        control={
          <Switch
            checked={form.ssoOnly}
            disabled={form.saving || (!available && !form.ssoOnly)}
            onCheckedChange={form.setSsoOnly}
          />
        }
      />
    </SettingsCard>
  );
}
