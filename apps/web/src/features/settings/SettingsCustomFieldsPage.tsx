'use client';

import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import CustomFieldsToolbar from './components/custom-fields/CustomFieldsToolbar';
import SettingsCustomFields from './components/custom-fields/SettingsCustomFields';

const section = settingsSection('custom-fields');

// The Custom fields settings page (/:team/:projectKey/settings/custom-fields).
export default function SettingsCustomFieldsPage() {
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  if (!project) return null;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      actions={
        <CustomFieldsToolbar
          projectKey={project.project.ref}
          resource={section.resource}
          fields={project.customFields}
          types={project.issueTypes}
        />
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsCustomFields project={project} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
