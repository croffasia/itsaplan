'use client';

import { useShell } from '@/context/shellContext';
import { AI_AGENTS_SECTION } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsCreateAction } from './components/crud/SettingsCreateAction';
import SettingsAiAgents from './components/ai-agents/SettingsAiAgents';
import { SettingsAiAgentSheet } from './components/ai-agents/SettingsAiAgentSheet';
import { useTranslations } from 'next-intl';

const section = AI_AGENTS_SECTION;

// The AI agents page (/project/:projectKey/ai-agents), a top-level nav item.
export default function SettingsAiAgentsPage() {
  const t = useTranslations('settings.agents');
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  if (!project) return null;
  const projectKey = project.project.key;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      actions={
        <SettingsCreateAction resource={section.resource} label={t('newAgent')}>
          {({ open, close }) => (
            <SettingsAiAgentSheet
              projectKey={projectKey}
              open={open}
              agent={null}
              onClose={close}
            />
          )}
        </SettingsCreateAction>
      }
      wide
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsAiAgents project={project} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
