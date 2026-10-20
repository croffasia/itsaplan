'use client';

import { useTranslations } from 'next-intl';
import SectionPageView from '@/components/common/page/SectionPageView';
import SectionPreview from '@/components/common/page/SectionPreview';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Skeleton } from '@/components/ui/skeleton';
import WorkspacePreviewField from './WorkspacePreviewField';

const GROUPS = ['40%', '55%', '30%'];

// The workspace's own SCIM, laid out as WorkspaceScimSettings lays it out.
export default function WorkspaceScimPreview() {
  const t = useTranslations('teams.workspace.scim');

  return (
    <SectionPageView title={t('title')} description={t('description')}>
      <SectionPreview>
        <div className="space-y-10">
          <SettingsSection
            title={t('provisioning')}
            description={t('provisioningConfigured')}
            action={<Skeleton className="h-5 w-9 rounded-full" />}
          >
            <SettingsCard className="space-y-6 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-medium">{t('token')}</div>
                  <Skeleton className="h-3 w-24" />
                  <p className="text-xs text-muted-foreground">{t('tokenHint')}</p>
                </div>
                <Skeleton className="h-8 w-32 shrink-0" />
              </div>
              <WorkspacePreviewField label={t('baseUrl')} hint={t('baseUrlHint')} />
            </SettingsCard>
          </SettingsSection>
          <SettingsSection title={t('groups')} description={t('groupsHint')}>
            <SettingsCard className="divide-y divide-border/60">
              {GROUPS.map((width) => (
                <div key={width} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5" style={{ width }} />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </SettingsCard>
          </SettingsSection>
        </div>
      </SectionPreview>
    </SectionPageView>
  );
}
