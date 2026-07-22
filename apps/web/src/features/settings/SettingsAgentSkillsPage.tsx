'use client';

import { useShell } from '@/context/shellContext';
import { AGENT_SKILLS_SECTION } from '@/utils/settingsSections';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsCreateAction } from './components/crud/SettingsCreateAction';
import SettingsAgentSkills from './components/agent-skills/SettingsAgentSkills';
import { SkillCreateDialog } from './components/agent-skills/SkillCreateDialog';

const section = AGENT_SKILLS_SECTION;

// The agent skills page (/project/:projectKey/agent-skills): the project skill
// library given to internal agents.
export default function SettingsAgentSkillsPage() {
  const { project } = useShell();
  if (!project) return null;
  const projectKey = project.project.key;
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      actions={
        <SettingsCreateAction resource={section.resource} label="New skill">
          {({ open, close }) =>
            open && <SkillCreateDialog projectKey={projectKey} onClose={close} />
          }
        </SettingsCreateAction>
      }
      wide
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsAgentSkills project={project} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
