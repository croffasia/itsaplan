'use client';

import { useShell } from '@/context/shellContext';
import { AGENT_TOOLS_SECTION } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import {
  useIntegrationCatalogQuery,
  useIntegrationOptionsQuery,
} from '@/services/integrations.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsCreateAction } from './components/crud/SettingsCreateAction';
import SettingsAgentTools from './components/agent-tools/SettingsAgentTools';
import { ToolConfigDialog } from './components/agent-tools/ToolConfigDialog';
import { useTranslations } from 'next-intl';

const section = AGENT_TOOLS_SECTION;

// The custom tools page (/project/:projectKey/agent-tools): external integrations
// internal agents can call, configured once per project.
export default function SettingsAgentToolsPage() {
  const t = useTranslations('settings.tools');
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  const key = project?.project.key ?? null;
  const catalog = useIntegrationCatalogQuery(key).data ?? [];
  const credentials = useIntegrationOptionsQuery(key, 'tool').data ?? [];
  if (!project) return null;
  const projectKey = project.project.key;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      actions={
        <SettingsCreateAction resource={section.resource} label={t('add')}>
          {({ open, close }) =>
            open && (
              <ToolConfigDialog
                projectKey={projectKey}
                catalog={catalog}
                credentials={credentials}
                onClose={close}
              />
            )
          }
        </SettingsCreateAction>
      }
      wide
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsAgentTools project={project} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
