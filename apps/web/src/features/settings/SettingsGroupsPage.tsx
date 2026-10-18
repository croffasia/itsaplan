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
import SettingsGroups from './components/groups/SettingsGroups';

const section = settingsSection('groups');

// The Groups settings page (/:team/:projectKey/settings/groups).
export default function SettingsGroupsPage() {
  const t = useTranslations('settings.groups');
  const sectionText = useSettingsSectionText()(section.slug);
  const { project } = useShell();
  // The add form is inline in the list; the header button opens it via this flag.
  const [adding, setAdding] = useState(false);
  if (!project) return null;
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      actions={
        <SettingsHeaderAddButton
          resource={section.resource}
          label={t('add')}
          onClick={() => setAdding(true)}
        />
      }
      wide
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <SettingsGroups project={project} adding={adding} onAddingChange={setAdding} />
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
