'use client';

import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import SettingsImportExport from './components/import-export/SettingsImportExport';
import SettingsImportExportDownloadButton from './components/import-export/SettingsImportExportDownloadButton';

const section = settingsSection('import-export');

// The Import/Export page (/:team/:projectKey/settings/import-export).
export default function SettingsImportExportPage() {
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  if (!project) return null;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      actions={<SettingsImportExportDownloadButton projectKey={project.project.ref} />}
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsImportExport project={project} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
