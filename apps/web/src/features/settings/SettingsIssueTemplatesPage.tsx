'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsHeaderAddButton } from './components/crud/SettingsHeaderAddButton';
import SettingsIssueTemplates from './components/issue-templates/SettingsIssueTemplates';

const section = settingsSection('issue-templates');

// The Issue templates settings page (/project/:projectKey/settings/issue-templates).
export default function SettingsIssueTemplatesPage() {
  const t = useTranslations('settings.issueTemplates');
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  const [addNew, setAddNew] = useState(false);
  if (!project) return null;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      wide
      actions={
        <SettingsHeaderAddButton
          resource={section.resource}
          label={t('addTemplate')}
          onClick={() => setAddNew(true)}
        />
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsIssueTemplates
            project={project}
            requestNew={addNew}
            onNewHandled={() => setAddNew(false)}
          />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
