'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ProjectFeatures } from '@/lib/api';
import { settingsPath } from '@/utils/paths';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import { useFeatureLabel } from '@/hooks/useFeatureLabel';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/page/EmptyState';
import { useTranslations } from 'next-intl';

// Gates a section that an owner can turn off for the project (Settings ->
// General). With the feature on it renders the section; with it off it explains
// where to turn it back on, and offers the link to an owner. Reaching a disabled
// section takes a typed URL — its navigation entries are hidden.
export default function RequireFeature({
  feature,
  children,
}: {
  feature: keyof ProjectFeatures;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  const featureLabel = useFeatureLabel();
  const features = useProjectFeatures();
  const { isOwner } = usePermissions();
  const params = useParams<{ projectKey: string }>();

  if (features[feature]) return <>{children}</>;

  return (
    <EmptyState
      title={t('featureOffTitle', { feature: featureLabel(feature) })}
      description={t('featureOffHint')}
    >
      {isOwner && params.projectKey && (
        <Button size="sm" asChild>
          <Link href={settingsPath(params.projectKey, 'general')}>{t('openGeneralSettings')}</Link>
        </Button>
      )}
    </EmptyState>
  );
}
