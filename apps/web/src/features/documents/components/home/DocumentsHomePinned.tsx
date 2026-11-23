'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { documentHomePinned } from '../../utils/documentHome';
import DocumentsHomeCard from './DocumentsHomeCard';
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
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
          {cards.map((card) => (
            <DocumentsHomeCard key={card.page.id} projectKey={projectKey} card={card} />
          ))}
        </div>
      ) : (
        <DocumentsHomePinnedEmpty projectKey={projectKey} documents={documents} />
      )}
    </section>
  );
}
