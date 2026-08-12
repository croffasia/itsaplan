import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Switch } from '@/components/ui/switch';
import type { SubtaskAutomationForm } from '../../hooks/useSubtaskAutomationForm';

// The Subtasks block of the Configuration page: the two automations that keep a
// parent and its subtasks closed together. Both off unless turned on here.
export default function SettingsSubtaskAutomation({ form }: { form: SubtaskAutomationForm }) {
  const t = useTranslations('settings.configuration');

  return (
    <SettingsSection title={t('subtasks')} description={t('subtasksHint')}>
      <SettingsCard className="divide-y divide-border/60">
        <SettingsRow
          title={t('completeParent')}
          description={t('completeParentHint')}
          control={
            <Switch
              checked={form.completeParent}
              disabled={!form.editable}
              onCheckedChange={form.setCompleteParent}
            />
          }
        />
        <SettingsRow
          title={t('closeSubtasks')}
          description={t('closeSubtasksHint')}
          control={
            <Switch
              checked={form.closeSubtasks}
              disabled={!form.editable}
              onCheckedChange={form.setCloseSubtasks}
            />
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
