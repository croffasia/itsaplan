'use client';

import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';

// The preview of a pinned card under the pointer while the card is dragged.
export default function DocumentsHomeCardOverlay({ page }: { page: ProjectDocumentSummary }) {
  const t = useTranslations('documents');

  return (
    <div className="flex cursor-grabbing items-center gap-3 rounded-xl bg-card p-4 shadow-[var(--overlay-shadow)]">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xl"
        aria-hidden
      >
        {page.icon || '📄'}
      </span>
      <span className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.01em]" dir="auto">
        {page.title.trim() || t('untitled')}
      </span>
    </div>
  );
}
