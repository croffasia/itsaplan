import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import type { AutoArchiveForm } from '../../hooks/useAutoArchiveForm';
import SettingsAutoArchiveRow from './SettingsAutoArchiveRow';

// The Archive block of the Configuration page: how long a closed issue may sit
// untouched before the worker archives it.
export default function SettingsAutoArchive({ form }: { form: AutoArchiveForm }) {
  const t = useTranslations('settings.configuration');

  return (
    <SettingsSection title={t('archive')} description={t('archiveHint')}>
      <SettingsCard className="divide-y divide-border/60">
        <SettingsAutoArchiveRow
          title={t('completedIssues')}
          description={t('staleHint')}
          on={form.completedOn}
          days={form.completedDays}
          editable={form.editable}
          onToggle={form.setCompletedOn}
          onDays={form.setCompletedDays}
        />
        <SettingsAutoArchiveRow
          title={t('canceledIssues')}
          description={t('staleHint')}
          on={form.canceledOn}
          days={form.canceledDays}
          editable={form.editable}
          onToggle={form.setCanceledOn}
          onDays={form.setCanceledDays}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
