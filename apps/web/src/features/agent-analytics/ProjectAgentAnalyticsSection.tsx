'use client';

import { useShell } from '@/context/shellContext';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { AGENT_ANALYTICS_SECTION } from '@/utils/settingsSections';
import AgentAnalyticsView from './components/AgentAnalyticsView';
import RetentionHint from './components/RetentionHint';

// The project's agent dashboard: the runs that worked in this project, whichever agent
// of the team made them. Gated by the agent_analytics resource, so a role grants it
// without granting the administrative agent permissions.
export default function ProjectAgentAnalyticsSection() {
  const sectionText = useSettingsSectionText()(AGENT_ANALYTICS_SECTION.slug);
  const { project } = useShell();

  return (
    <SectionPageView
      title={sectionText.label}
      description={
        <>
          {sectionText.description} <RetentionHint />
        </>
      }
      wide
    >
      <RequirePermission resource={AGENT_ANALYTICS_SECTION.resource} action="read">
        {project && <AgentAnalyticsView scope={{ projectKey: project.project.key }} />}
      </RequirePermission>
    </SectionPageView>
  );
}
