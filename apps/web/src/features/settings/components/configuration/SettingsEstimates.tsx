import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Switch } from '@/components/ui/switch';
import type { EstimatesForm } from '../../hooks/useEstimatesForm';

// The Estimates block of the Configuration page: which kinds of estimate the
// issues of this project carry, and whether its members log the time they spend.
// All off unless turned on here; a team can log time without estimating first, so
// the third switch stands on its own.
export default function SettingsEstimates({ form }: { form: EstimatesForm }) {
  const t = useTranslations('settings.configuration');

  return (
    <SettingsSection title={t('estimates')} description={t('estimatesHint')}>
      <SettingsCard className="divide-y divide-border/60">
        <SettingsRow
          title={t('pointsEstimate')}
          description={t('pointsEstimateHint')}
          control={
            <Switch
              checked={form.points}
              disabled={!form.editable}
              onCheckedChange={form.setPoints}
            />
          }
        />
        <SettingsRow
          title={t('timeEstimate')}
          description={t('timeEstimateHint')}
          control={
            <Switch checked={form.time} disabled={!form.editable} onCheckedChange={form.setTime} />
          }
        />
        <SettingsRow
          title={t('timeLogging')}
          description={t('timeLoggingHint')}
          control={
            <Switch
              checked={form.logging}
              disabled={!form.editable}
              onCheckedChange={form.setLogging}
            />
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
