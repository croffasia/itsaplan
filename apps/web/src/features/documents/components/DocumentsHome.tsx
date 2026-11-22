'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRelativeTime } from '@/context/relativeTimeContext';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { documentHomeSections, HOME_LIST_LIMIT } from '../utils/documentHome';
import type { DocumentListTab } from '../utils/documentList';
import DocumentsHomeCard from './DocumentsHomeCard';
import DocumentsHomeEmpty from './DocumentsHomeEmpty';
import DocumentsHomeList from './DocumentsHomeList';

export default function DocumentsHome({
  projectKey,
  documents,
  onOpenTree,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
  onOpenTree: (tab: DocumentListTab) => void;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  const { pinned, favorites, recent } = useMemo(() => documentHomeSections(documents), [documents]);

  return (
    <div className="grid items-start gap-x-8 gap-y-6 py-1 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <section>
          <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">
            {t('pinnedPages')}
          </h2>
          {pinned.length > 0 ? (
            <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pinned.map((card) => (
                <DocumentsHomeCard
                  key={card.page.id}
                  projectKey={projectKey}
                  card={card}
                  onSeeAll={() => onOpenTree('public')}
                />
              ))}
            </div>
          ) : (
            <DocumentsHomeEmpty
              title={t('pinnedEmptyTitle')}
              description={t('pinnedEmptyDescription')}
            />
          )}
        </section>

        <DocumentsHomeList
          projectKey={projectKey}
          title={t('favoritePages')}
          documents={favorites.slice(0, HOME_LIST_LIMIT)}
          empty={
            <DocumentsHomeEmpty
              title={t('favoritesEmptyTitle')}
              description={t('favoritesEmptyDescription')}
            />
          }
          footer={
            favorites.length > HOME_LIST_LIMIT && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-7 self-start px-2 text-xs text-muted-foreground"
                onClick={() => onOpenTree('favorites')}
              >
                {t('seeAll', { count: favorites.length })}
              </Button>
            )
          }
        />
      </div>

      <DocumentsHomeList
        projectKey={projectKey}
        title={t('recentlyUpdated')}
        documents={recent}
        detail={(document) => (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {relativeTime(document.updatedAt)}
          </span>
        )}
      />
    </div>
  );
}
