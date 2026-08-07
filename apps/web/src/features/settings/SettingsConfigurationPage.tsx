'use client';

import { toast } from 'sonner';
import type { ProjectDetail } from '@/lib/api';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import SettingsSubtaskAutomation from './components/configuration/SettingsSubtaskAutomation';
import SettingsAutoArchive from './components/configuration/SettingsAutoArchive';
import { useAutoArchiveForm } from './hooks/useAutoArchiveForm';
import { useSubtaskAutomationForm } from './hooks/useSubtaskAutomationForm';

const section = settingsSection('configuration');

// The Configuration settings page (/project/:projectKey/settings/configuration).
// Holds the subtask automations and the auto-archive thresholds; the Save in the
// page header writes both.
export default function SettingsConfigurationPage() {
  const { project } = useShell();
  if (!project) return null;
  return <ConfigurationPage project={project} />;
}

function ConfigurationPage({ project }: { project: ProjectDetail }) {
  const { can } = usePermissions();
  const subtasks = useSubtaskAutomationForm(project.project.key);
  const archive = useAutoArchiveForm(project.project.key);
  const saving = subtasks.saving || archive.saving;
  const loaded = subtasks.loaded && archive.loaded;

  async function save() {
    await subtasks.save();
    await archive.save();
    toast.success('Changes saved');
  }

  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
      actions={
        can(section.resource, 'edit') ? (
          <Button size="sm" onClick={() => void save()} disabled={saving || !loaded}>
            Save
          </Button>
        ) : undefined
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <div className="space-y-10">
            <SettingsSubtaskAutomation form={subtasks} />
            <SettingsAutoArchive form={archive} />
          </div>
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
