import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import { PREFERENCE_DEFAULTS, useAccountPreferencesQuery } from '@/services/preferences.service';
import AccountPreferenceRow from '../AccountPreferenceRow';

export default function AccountNotificationAutoWatch({
  onChange,
}: {
  onChange: (autoWatch: boolean) => void;
}) {
  const t = useTranslations('account.notifications');
  const { data, isPending } = useAccountPreferencesQuery();
  return (
    <section className="border-t py-4">
      <AccountPreferenceRow label={t('autoWatch')} description={t('autoWatchDescription')}>
        <Switch
          checked={(data ?? PREFERENCE_DEFAULTS).autoWatch}
          onCheckedChange={onChange}
          disabled={isPending}
          aria-label={t('autoWatch')}
        />
      </AccountPreferenceRow>
    </section>
  );
}
