'use client';

import { useShell } from '@/context/shellContext';
import { INTEGRATIONS_SECTION } from '@/utils/settingsSections';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsCreateAction } from './components/crud/SettingsCreateAction';
import SettingsIntegrations from './components/integrations/SettingsIntegrations';
import { CredentialDialog } from './components/integrations/CredentialDialog';

const section = INTEGRATIONS_SECTION;

// The integrations page (/project/:projectKey/integrations): stored credentials for
// AI providers and tool integrations.
export default function SettingsIntegrationsPage() {
  const { project } = useShell();
  const catalog = useIntegrationCatalogQuery(project?.project.key ?? null).data ?? [];
  if (!project) return null;
  const projectKey = project.project.key;
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      actions={
        <SettingsCreateAction resource={section.resource} label="Add credential">
          {({ open, close }) =>
            open && (
              <CredentialDialog
                projectKey={projectKey}
                catalog={catalog}
                existing={null}
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
          <SettingsIntegrations project={project} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
