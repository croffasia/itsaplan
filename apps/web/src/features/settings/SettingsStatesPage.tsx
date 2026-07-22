'use client';

import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import SettingsStates from './components/states/SettingsStates';
import StatesToolbar from './components/states/StatesToolbar';

const section = settingsSection('states');

// The States settings page (/project/:projectKey/settings/states).
export default function SettingsStatesPage() {
  const { project } = useShell();
  if (!project) return null;
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
      actions={<StatesToolbar projectKey={project.project.key} columns={project.columns} />}
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsStates project={project} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
