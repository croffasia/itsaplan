'use client';

import { useTranslations } from 'next-intl';
import SectionPageView from '@/components/common/page/SectionPageView';
import SectionPreview from '@/components/common/page/SectionPreview';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const THEMES = ['light', 'dark'] as const;

export default function WorkspacePortalPreview() {
  const t = useTranslations('sections.previews.portal');

  return (
    <SectionPageView title={t('title')} description={t('description')}>
      <SectionPreview>
        <div className="space-y-10">
          <SettingsSection title={t('general')}>
            <SettingsCard className="divide-y divide-border/60">
              <SettingsRow
                title={t('forms')}
                description={t('formsHint')}
                control={<Skeleton className="h-5 w-9 shrink-0 rounded-full" />}
              />
              <SettingsRow
                title={t('name')}
                description={t('nameHint')}
                control={<Skeleton className="h-8 w-40 shrink-0 sm:w-72" />}
              />
              <div>
                <SettingsRow
                  title={t('address')}
                  description={t('addressHint')}
                  control={<Skeleton className="h-8 w-32 shrink-0 sm:w-60" />}
                />
                <div className="px-4 pb-4">
                  <div className="flex items-start justify-between gap-4 border-t border-border/60 pt-4">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="text-sm font-medium">{t('link')}</div>
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="size-9 shrink-0" />
                  </div>
                </div>
              </div>
            </SettingsCard>
          </SettingsSection>
          <SettingsSection title={t('logo')} description={t('logoHint')}>
            <SettingsCard className="grid gap-4 p-4 sm:grid-cols-2">
              {THEMES.map((theme) => (
                <div key={theme} className="space-y-2">
                  <p className="text-sm font-medium">{t(theme)}</p>
                  <div
                    className={cn(
                      'flex h-24 items-center justify-center rounded-md border border-border/60',
                      theme === 'dark' ? 'bg-neutral-900' : 'bg-white',
                    )}
                  >
                    <Skeleton
                      className={cn(
                        'h-8 w-28',
                        theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-200',
                      )}
                    />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </SettingsCard>
          </SettingsSection>
        </div>
      </SectionPreview>
    </SectionPageView>
  );
}
