'use client';

import { useTranslations } from 'next-intl';
import SectionPageView from '@/components/common/page/SectionPageView';
import SectionPreview from '@/components/common/page/SectionPreview';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import { Skeleton } from '@/components/ui/skeleton';

export default function WorkspaceEmailDomainsPreview() {
  const t = useTranslations('sections.previews.emailDomains');

  return (
    <SectionPageView title={t('title')} description={t('description')}>
      <SectionPreview>
        <SettingsCard>
          <SettingsRow
            title={t('label')}
            description={t('hint')}
            control={<Skeleton className="h-9 w-40 shrink-0 sm:w-72" />}
          />
        </SettingsCard>
      </SectionPreview>
    </SectionPageView>
  );
}
