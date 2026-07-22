'use client';

import { useState } from 'react';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import IssueTypesToolbar from './components/issue-types/IssueTypesToolbar';
import SettingsIssueTypes from './components/issue-types/SettingsIssueTypes';

const section = settingsSection('issue-types');

// The Issue types settings page (/project/:projectKey/settings/issue-types).
export default function SettingsIssueTypesPage() {
  const { project } = useShell();
  // The add form is inline in the list; the header button opens it via this flag.
  const [adding, setAdding] = useState(false);
  if (!project) return null;
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      actions={
        <IssueTypesToolbar
          projectKey={project.project.key}
          resource={section.resource}
          types={project.issueTypes}
          onAdd={() => setAdding(true)}
        />
      }
      wide
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsIssueTypes project={project} adding={adding} onAddingChange={setAdding} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
