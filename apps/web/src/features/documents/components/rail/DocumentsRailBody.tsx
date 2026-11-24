'use client';

import { useEffect, useRef } from 'react';
import { House, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  NewProjectDocumentInput,
  ProjectDocumentSummary,
} from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { documentsPath } from '@/utils/paths';
import { useDocumentsRailView } from '../../hooks/useDocumentsRailView';
import DocumentsRailEmpty from './DocumentsRailEmpty';
import DocumentsRailIcon from '../DocumentsRailIcon';
import DocumentsRailLink from './DocumentsRailLink';
import DocumentsRailPages from './DocumentsRailPages';
import DocumentsRailResults from './DocumentsRailResults';

const SKELETON_WIDTHS = ['70%', '88%', '62%', '80%', '54%', '74%', '66%'];

export default function DocumentsRailBody({
  projectKey,
  homeActive,
  activeId,
  documents,
  loading,
  failed,
  search,
  results,
  canCreate,
  creating,
  onRetry,
  onCreate,
}: {
  projectKey: string;
  homeActive: boolean;
  activeId: number | null;
  documents: ProjectDocumentSummary[];
  loading: boolean;
  failed: boolean;
  search: string;
  results: ProjectDocumentSummary[] | undefined;
  canCreate: boolean;
  creating: boolean;
  onRetry: () => void;
  onCreate: (input: NewProjectDocumentInput) => void;
}) {
  const t = useTranslations('documents');
  const { scroll, setView } = useDocumentsRailView(projectKey);
  const scroller = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const lastScroll = useRef(scroll);
  useEffect(() => {
    if (loading || restored.current || !scroller.current) return;
    scroller.current.scrollTop = scroll;
    lastScroll.current = scroll;
    restored.current = true;
  }, [loading, scroll]);
  useEffect(
    () => () => setView((previous) => ({ ...previous, scroll: lastScroll.current })),
    [setView],
  );

  const content = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-2 p-2" aria-hidden>
          {SKELETON_WIDTHS.map((width) => (
            <Skeleton key={width} className="h-5 rounded-md" style={{ width }} />
          ))}
        </div>
      );
    }
    if (failed) {
      return (
        <DocumentsRailEmpty
          title={t('loadFailed')}
          action={
            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[13px]" onClick={onRetry}>
              <RefreshCw />
              {t('reload')}
            </Button>
          }
        />
      );
    }
    if (search) {
      return (
        <DocumentsRailResults
          projectKey={projectKey}
          query={search}
          results={results}
          activeId={activeId}
          canCreate={canCreate}
          creating={creating}
          onCreate={(title) => onCreate({ title, parentId: null, isPrivate: false })}
        />
      );
    }
    return (
      <>
        <DocumentsRailLink
          href={documentsPath(projectKey)}
          active={homeActive}
          icon={<DocumentsRailIcon icon={null} fallback={<House className="size-3.5" />} />}
          title={t('homeView')}
        />
        {documents.length === 0 ? (
          <DocumentsRailEmpty title={t('emptyTitle')} description={t('railEmptyHint')} />
        ) : (
          <DocumentsRailPages
            projectKey={projectKey}
            documents={documents}
            activeId={activeId}
            canCreate={canCreate}
            creating={creating}
            onCreate={onCreate}
          />
        )}
      </>
    );
  };

  return (
    <div
      ref={scroller}
      className="min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto px-2 pt-1 pb-4"
      onScroll={(event) => {
        lastScroll.current = event.currentTarget.scrollTop;
      }}
    >
      {content()}
    </div>
  );
}
