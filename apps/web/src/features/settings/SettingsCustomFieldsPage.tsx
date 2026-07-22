'use client';

import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import CustomFieldsToolbar from './components/custom-fields/CustomFieldsToolbar';
import SettingsCustomFields from './components/custom-fields/SettingsCustomFields';

const section = settingsSection('custom-fields');

// The Custom fields settings page (/project/:projectKey/settings/custom-fields).
export default function SettingsCustomFieldsPage() {
  const { project } = useShell();
  if (!project) return null;
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
      actions={
        <CustomFieldsToolbar
          projectKey={project.project.key}
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
