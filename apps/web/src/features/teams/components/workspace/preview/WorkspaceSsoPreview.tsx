'use client';

import { useTranslations } from 'next-intl';
import SectionPageView from '@/components/common/page/SectionPageView';
import SectionPreview from '@/components/common/page/SectionPreview';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Skeleton } from '@/components/ui/skeleton';
import WorkspacePreviewField from './WorkspacePreviewField';

const FIELDS = [
  'domains',
  'entryPoint',
  'entityId',
  'certificate',
  'acsUrl',
  'spEntityId',
] as const;

export default function WorkspaceSsoPreview() {
  const t = useTranslations('sections.previews.sso');

  return (
    <SectionPageView title={t('title')} description={t('description')}>
      <SectionPreview>
        <SettingsSection
          title={t('provider')}
          description={t('providerHint')}
          action={<Skeleton className="h-8 w-28" />}
        >
          <SettingsCard className="space-y-6 p-4">
            {FIELDS.map((field) => (
              <WorkspacePreviewField
                key={field}
                label={t(`fields.${field}`)}
                tall={field === 'certificate'}
              />
            ))}
          </SettingsCard>
        </SettingsSection>
      </SectionPreview>
    </SectionPageView>
  );
}
