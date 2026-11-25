'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { documentHomePinned } from '../../utils/documentHome';
import DocumentsHomePinnedCards from './DocumentsHomePinnedCards';
import DocumentsHomePinnedEmpty from './DocumentsHomePinnedEmpty';

export default function DocumentsHomePinned({
  projectKey,
  documents,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
}) {
  const t = useTranslations('documents');
  const cards = useMemo(() => documentHomePinned(documents), [documents]);

  return (
    <section aria-labelledby="documents-home-pinned" className="@container">
      <h2 id="documents-home-pinned" className="mb-3 text-[13px] font-medium text-muted-foreground">
        {t('pinnedPages')}
      </h2>
      {cards.length > 0 ? (
        <DocumentsHomePinnedCards projectKey={projectKey} cards={cards} />
      ) : (
        <DocumentsHomePinnedEmpty projectKey={projectKey} documents={documents} />
      )}
    </section>
  );
}
