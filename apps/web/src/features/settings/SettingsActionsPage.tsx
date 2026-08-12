'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import { SettingsHeaderAddButton } from './components/crud/SettingsHeaderAddButton';
import SettingsActions from './components/actions/SettingsActions';

const section = settingsSection('actions');

// The Actions settings page (/project/:projectKey/settings/actions). The actions
// section also needs the project's custom fields for the condition editor.
export default function SettingsActionsPage() {
  const t = useTranslations('settings.actions');
  const sectionText = useSettingsSectionText()(section.slug);
  const { project, customFields } = useShell();
  const [addNew, setAddNew] = useState(false);
  if (!project) return null;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      wide
      actions={
        <SettingsHeaderAddButton
          resource={section.resource}
          label={t('new')}
          onClick={() => setAddNew(true)}
        />
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsActions
            project={project}
            customFields={customFields}
            requestNew={addNew}
            onNewHandled={() => setAddNew(false)}
          />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
