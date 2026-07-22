'use client';

import { useShell } from '@/context/shellContext';
import { AGENT_TOOLS_SECTION } from '@/utils/settingsSections';
import { useIntegrationCatalogQuery, useCredentialsQuery } from '@/services/integrations.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsCreateAction } from './components/crud/SettingsCreateAction';
import SettingsAgentTools from './components/agent-tools/SettingsAgentTools';
import { ToolConfigDialog } from './components/agent-tools/ToolConfigDialog';

const section = AGENT_TOOLS_SECTION;

// The custom tools page (/project/:projectKey/agent-tools): external integrations
// internal agents can call, configured once per project.
export default function SettingsAgentToolsPage() {
  const { project } = useShell();
  const key = project?.project.key ?? null;
  const catalog = useIntegrationCatalogQuery(key).data ?? [];
  const credentials = useCredentialsQuery(key).data ?? [];
  if (!project) return null;
  const projectKey = project.project.key;
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      actions={
        <SettingsCreateAction resource={section.resource} label="Add tool">
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
