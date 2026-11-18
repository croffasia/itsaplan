'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProFeature } from '@/utils/app';
import UpgradeToProButton from '../UpgradeToProButton';

// Where a section the hosted build and Pro add is available, shown with its preview.
export default function SectionPreviewBanner({ feature }: { feature: ProFeature }) {
  const t = useTranslations('sections.previews');

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-2">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" />
        {t('available')}
      </p>
      <UpgradeToProButton feature={feature} />
    </div>
  );
}
