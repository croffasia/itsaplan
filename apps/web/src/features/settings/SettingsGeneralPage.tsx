'use client';

import type { ProjectDetail } from '@/lib/api';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { Button } from '@/components/ui/button';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import SettingsGeneral from './components/general/SettingsGeneral';
import { useGeneralForm } from './hooks/useGeneralForm';

const section = settingsSection('general');

// The General settings page (/project/:projectKey/settings/general). Edits the
// project name and description; the key is shown read-only. Save lives in the page
// header.
export default function SettingsGeneralPage() {
  const { project } = useShell();
  if (!project) return null;
  return <GeneralPage project={project} />;
}

function GeneralPage({ project }: { project: ProjectDetail }) {
  const form = useGeneralForm(project);
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
      actions={
        form.editable ? (
          <Button size="sm" onClick={() => void form.save()} disabled={!form.canSave}>
            Save
          </Button>
        ) : undefined
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsGeneral form={form} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
