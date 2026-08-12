'use client';

import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api';
import { useShell } from '@/context/shellContext';
import { settingsSection } from '@/utils/settingsSections';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import { Button } from '@/components/ui/button';
import SectionPageView from '@/components/common/page/SectionPageView';
import RequirePermission from '@/components/common/permissions/RequirePermission';
import { SettingsResourceProvider } from './context/settingsPermission';
import SettingsGeneral from './components/general/SettingsGeneral';
import SettingsFeatures from './components/general/SettingsFeatures';
import { useGeneralForm } from './hooks/useGeneralForm';
import { useFeatureToggles } from './hooks/useFeatureToggles';

const section = settingsSection('general');

// The General settings page (/project/:projectKey/settings/general). Edits the
// project name and description; the key is shown read-only. Save lives in the page
// header.
export default function SettingsGeneralPage() {
  const { project } = useShell();
  if (!project) return null;
  return <GeneralPage project={project} />;
}

function GeneralPage({ project }: { project: ProjectDetail }) {
  const t = useTranslations('common');
  const sectionText = useSettingsSectionText()(section.slug);
  const form = useGeneralForm(project);
  const features = useFeatureToggles(project);
  return (
    <SectionPageView
      title={sectionText.label}
      description={sectionText.description}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
      actions={
        form.editable ? (
          <Button size="sm" onClick={() => void form.save()} disabled={!form.canSave}>
            {t('save')}
          </Button>
        ) : undefined
      }
    >
      <SettingsResourceProvider resource={section.resource}>
        <RequirePermission resource={section.resource} action="read">
          <div className="space-y-10">
            <SettingsGeneral form={form} />
            <SettingsFeatures form={features} />
          </div>
        </RequirePermission>
      </SettingsResourceProvider>
    </SectionPageView>
  );
}
