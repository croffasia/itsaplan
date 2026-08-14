'use client';

import { useState } from 'react';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { useAiAgentsQuery } from '@/services/aiAgents.service';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsHeaderAddButton } from './components/crud/SettingsHeaderAddButton';
import SettingsSchedules from './components/schedules/SettingsSchedules';
import { useTranslations } from 'next-intl';

const section = settingsSection('schedules');

// The Schedules page (/project/:projectKey/ai-team/schedules), listed in the main
// sidebar's AI Team group.
export default function SettingsSchedulesPage() {
  const t = useTranslations('settings.schedules');
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  const [addNew, setAddNew] = useState(false);
  const agents = useAiAgentsQuery(project?.project.key ?? null).data ?? [];
  if (!project) return null;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      wide
      actions={
        // Without an agent there is nothing to schedule, so the add action is hidden
        // and the list explains what is missing.
        agents.length > 0 ? (
          <SettingsHeaderAddButton
            resource={section.resource}
            label={t('newTitle')}
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
