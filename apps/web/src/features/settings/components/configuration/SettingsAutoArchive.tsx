import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import type { AutoArchiveForm } from '../../hooks/useAutoArchiveForm';
import SettingsAutoArchiveRow from './SettingsAutoArchiveRow';

// The Archive block of the Configuration page: how long a closed issue may sit
// untouched before the worker archives it.
export default function SettingsAutoArchive({ form }: { form: AutoArchiveForm }) {
  return (
    <SettingsSection
      title="Archive"
      description="Archive stale closed issues so the board stays clear."
    >
      <SettingsCard className="divide-y divide-border/60">
        <SettingsAutoArchiveRow
          title="Completed issues"
          description="Archive after this many days without activity."
          on={form.completedOn}
          days={form.completedDays}
          editable={form.editable}
          onToggle={form.setCompletedOn}
          onDays={form.setCompletedDays}
        />
        <SettingsAutoArchiveRow
          title="Canceled issues"
          description="Archive after this many days without activity."
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
