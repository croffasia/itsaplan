'use client';

import type { ReactNode } from 'react';
import type { ProFeature } from '@/utils/app';
import SectionPreviewBanner from './SectionPreviewBanner';

// The page of a preview: shown, not used, with its skeletons still.
export const SECTION_PREVIEW_CONTENT_CLASS =
  'pointer-events-none select-none [&_[data-slot=skeleton]]:animate-none';

// A section the hosted build and Pro add: where it is available, over the page laid out
// as it is there, with skeletons in place of the figures.
export default function SectionPreview({
  feature,
  children,
}: {
  feature: ProFeature;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8 pb-10">
      <SectionPreviewBanner feature={feature} />
      <div className={SECTION_PREVIEW_CONTENT_CLASS} aria-hidden>
        {children}
      </div>
    </div>
  );
}
