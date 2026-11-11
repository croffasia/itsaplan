'use client';

import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import UpgradeToProButton from '../UpgradeToProButton';

// A section the hosted build and Pro add: where it is available, over the page laid out
// as it is there, with skeletons in place of the figures.
export default function SectionPreview({ children }: { children: ReactNode }) {
  const t = useTranslations('sections.previews');

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          {t('available')}
        </p>
        <UpgradeToProButton />
      </div>
      <div
        className="pointer-events-none select-none [&_[data-slot=skeleton]]:animate-none"
        aria-hidden
      >
        {children}
      </div>
    </div>
  );
}
