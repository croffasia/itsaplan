'use client';

import { useShell } from '@/context/shellContext';
import { INTEGRATIONS_SECTION } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsCreateAction } from './components/crud/SettingsCreateAction';
import SettingsIntegrations from './components/integrations/SettingsIntegrations';
import { CredentialDialog } from './components/integrations/CredentialDialog';
import { useTranslations } from 'next-intl';

const section = INTEGRATIONS_SECTION;

// The integrations page (/project/:projectKey/integrations): stored credentials for
// AI providers and tool integrations.
export default function SettingsIntegrationsPage() {
  const t = useTranslations('settings.integrations');
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  const catalog = useIntegrationCatalogQuery(project?.project.key ?? null).data ?? [];
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
