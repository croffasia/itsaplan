'use client';

import { useState } from 'react';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsHeaderAddButton } from './components/crud/SettingsHeaderAddButton';
import SettingsWebhooks from './components/webhooks/SettingsWebhooks';

const section = settingsSection('webhooks');

// The Webhooks settings page (/project/:projectKey/settings/webhooks).
export default function SettingsWebhooksPage() {
  const { project } = useShell();
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
          label="New webhook"
          onClick={() => setAddNew(true)}
        />
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsWebhooks
            project={project}
            requestNew={addNew}
            onNewHandled={() => setAddNew(false)}
          />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
