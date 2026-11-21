'use client';

import { useMemo } from 'react';
import { FileText, Pin } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRelativeTime } from '@/context/relativeTimeContext';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { documentPath } from '@/utils/paths';
import { documentHomeSections, HOME_LIST_LIMIT } from '../utils/documentHome';
import DocumentsHomeCard from './DocumentsHomeCard';
import DocumentsHomeList from './DocumentsHomeList';

export default function DocumentsHome({
  projectKey,
  documents,
  onSeeFavorites,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
  onSeeFavorites: () => void;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  const { pinned, cards, favorites, recent } = useMemo(
    () => documentHomeSections(documents),
    [documents],
  );

  return (
    <div className="space-y-6 py-1">
      {pinned.length > 0 && (
        <section className="flex flex-wrap items-center gap-1.5" aria-label={t('pinnedPages')}>
          <span className="flex items-center gap-1.5 pe-1 text-xs font-medium text-muted-foreground">
            <Pin className="size-3.5" />
            {t('pinnedPages')}
          </span>
          {pinned.map((document) => (
            <Button
              key={document.id}
              asChild
              variant="outline"
              size="sm"
              className="h-8 max-w-full px-2.5 text-[13px] shadow-none"
            >
              <Link href={documentPath(projectKey, document.id)}>
                <span className="text-muted-foreground" aria-hidden>
                  {document.icon ? document.icon : <FileText />}
                </span>
                <span className="truncate" dir="auto">
                  {document.title.trim() || t('untitled')}
                </span>
              </Link>
            </Button>
          ))}
        </section>
      )}

      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <DocumentsHomeCard key={card.page.id} projectKey={projectKey} card={card} />
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {favorites.length > 0 && (
          <DocumentsHomeList
            projectKey={projectKey}
            title={t('favoritePages')}
            documents={favorites.slice(0, HOME_LIST_LIMIT)}
            footer={
              favorites.length > HOME_LIST_LIMIT && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 self-start px-2 text-xs text-muted-foreground"
                  onClick={onSeeFavorites}
                >
                  {t('seeAll', { count: favorites.length })}
                </Button>
              )
            }
          />
        )}
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
    </div>
  );
}
