'use client';

import { useState } from 'react';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsHeaderAddButton } from './components/crud/SettingsHeaderAddButton';
import SettingsActions from './components/actions/SettingsActions';

const section = settingsSection('actions');

// The Actions settings page (/project/:projectKey/settings/actions). The actions
// section also needs the project's custom fields for the condition editor.
export default function SettingsActionsPage() {
  const { project, customFields } = useShell();
  const [addNew, setAddNew] = useState(false);
  if (!project) return null;
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      wide
      actions={
        <SettingsHeaderAddButton
          resource={section.resource}
          label="New action"
          onClick={() => setAddNew(true)}
        />
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsActions
            project={project}
            customFields={customFields}
            requestNew={addNew}
            onNewHandled={() => setAddNew(false)}
          />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
