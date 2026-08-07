import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Switch } from '@/components/ui/switch';
import type { SubtaskAutomationForm } from '../../hooks/useSubtaskAutomationForm';

// The Subtasks block of the Configuration page: the two automations that keep a
// parent and its subtasks closed together. Both off unless turned on here.
export default function SettingsSubtaskAutomation({ form }: { form: SubtaskAutomationForm }) {
  return (
    <SettingsSection
      title="Subtasks"
      description="Only closing is synced. Moving an issue between open states changes nothing else."
    >
      <SettingsCard className="divide-y divide-border/60">
        <SettingsRow
          title="Close the parent when its subtasks are done"
          description="The parent moves to the state its last subtask closed in."
          control={
            <Switch
              checked={form.completeParent}
              disabled={!form.editable}
              onCheckedChange={form.setCompleteParent}
            />
          }
        />
        <SettingsRow
          title="Close subtasks when the parent closes"
          description="Open subtasks move to the state the parent closed in."
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
