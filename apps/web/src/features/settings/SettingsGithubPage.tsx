'use client';

import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import SettingsGithub from './components/github/SettingsGithub';

const section = settingsSection('github');

// The GitHub settings page (/project/:projectKey/settings/github).
export default function SettingsGithubPage() {
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  if (!project) return null;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsGithub project={project} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
