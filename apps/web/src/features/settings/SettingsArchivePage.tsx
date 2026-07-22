'use client';

import type { ProjectDetail } from '@/lib/api';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { Button } from '@/components/ui/button';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import SettingsArchive from './components/archive/SettingsArchive';
import { useAutoArchiveForm } from './hooks/useAutoArchiveForm';

const section = settingsSection('archive');

// The Archive settings page (/project/:projectKey/settings/archive). Shows the
// auto-archive thresholds; Save lives in the page header.
export default function SettingsArchivePage() {
  const { project } = useShell();
  if (!project) return null;
  return <ArchivePage project={project} />;
}

function ArchivePage({ project }: { project: ProjectDetail }) {
  const form = useAutoArchiveForm(project.project.key);
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
      actions={
        form.editable ? (
          <Button size="sm" onClick={() => void form.save()} disabled={form.saving}>
            Save
          </Button>
        ) : undefined
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsArchive form={form} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
