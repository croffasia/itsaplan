'use client';

import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import LabelsToolbar from './components/labels/LabelsToolbar';
import SettingsLabels from './components/labels/SettingsLabels';

const section = settingsSection('labels');

// The Labels settings page (/:team/:projectKey/settings/labels).
export default function SettingsLabelsPage() {
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  if (!project) return null;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      actions={
        <LabelsToolbar
          projectKey={project.project.ref}
          resource={section.resource}
          groups={project.labelGroups}
          labels={project.labels}
        />
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsLabels project={project} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
