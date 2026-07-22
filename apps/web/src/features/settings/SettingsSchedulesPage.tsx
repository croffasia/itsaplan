'use client';

import { useState } from 'react';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { useInternalAgents } from './hooks/useInternalAgents';
import { SettingsHeaderAddButton } from './components/crud/SettingsHeaderAddButton';
import SettingsSchedules from './components/schedules/SettingsSchedules';

const section = settingsSection('schedules');

// The Schedules page (/project/:projectKey/ai-team/schedules), listed in the main
// sidebar's AI Team group.
export default function SettingsSchedulesPage() {
  const { project } = useShell();
  const [addNew, setAddNew] = useState(false);
  const { agents } = useInternalAgents(project?.project.key ?? null);
  if (!project) return null;
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      wide
      actions={
        // Without an internal agent there is nothing to schedule, so the add action
        // is hidden and the list explains what is missing.
        agents.length > 0 ? (
          <SettingsHeaderAddButton
            resource={section.resource}
            label="New schedule"
            onClick={() => setAddNew(true)}
          />
        ) : null
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsSchedules
            project={project}
            requestNew={addNew}
            onNewHandled={() => setAddNew(false)}
          />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
