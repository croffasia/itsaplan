'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { useDocumentCreate } from '../../hooks/useDocumentCreate';
import { useDocumentsSearch } from '../../hooks/useDocumentsSearch';
import { useDocumentsQuery } from '../../services/documents.service';
import DocumentsRailArchiveLink from './DocumentsRailArchiveLink';
import DocumentsRailBody from './DocumentsRailBody';
import DocumentsRailHeader from './DocumentsRailHeader';
import DocumentsRailSearch from './DocumentsRailSearch';

// The page tree beside every Docs screen. Below `md` it is a drawer over the page.
export default function DocumentsRail({
  projectKey,
  view,
  activeId,
  canRead,
  open,
  shown,
  onOpenChange,
}: {
  projectKey: string;
  view: 'home' | 'archive' | 'page';
  activeId: number | null;
  canRead: boolean;
  open: boolean;
  shown: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('documents');
  const { can } = usePermissions();
  const canCreate = can('documents', 'create');
  const live = useDocumentsQuery(projectKey, '', false, canRead);
  const archived = useDocumentsQuery(projectKey, '', true, canRead);
  const [search, setSearch] = useDocumentsSearch(projectKey);
  const term = useDebouncedValue(search.trim(), 250);
  const results = useDocumentsQuery(projectKey, term, false, canRead && term.length > 0);
  const { create, upload, creating } = useDocumentCreate(projectKey);
  const aside = useRef<HTMLElement>(null);
  const documents = live.data ?? [];
  const archivedCount = archived.data?.length ?? null;
  useExitOnEscape(() => onOpenChange(false), open);
  useEffect(() => {
    if (open) aside.current?.focus();
  }, [open]);

  return (
    <>
      <aside
        ref={aside}
        tabIndex={-1}
        aria-label={t('railLabel')}
        className={cn(
          'flex w-68 shrink-0 flex-col overflow-hidden bg-rail outline-none',
          'motion-reduce:transition-none max-md:fixed max-md:inset-y-0 max-md:start-0 max-md:z-40 max-md:w-[min(86vw,20rem)] max-md:pt-[env(safe-area-inset-top)] max-md:shadow-[var(--side-panel-shadow)] max-md:transition-[translate,visibility] max-md:duration-250 max-md:ease-out',
          !open && 'max-md:invisible max-md:-translate-x-full max-md:rtl:translate-x-full',
          !shown && 'md:hidden',
        )}
      >
        <DocumentsRailHeader
          projectKey={projectKey}
          count={canRead && live.isSuccess ? documents.length : null}
          documents={documents}
          showTools={canRead}
          canCreate={canCreate}
          creating={creating}
          onCreate={() => void create({ parentId: null, isPrivate: false })}
          onUpload={(file) => void upload(file)}
        />
        {canRead && (
          <>
            <DocumentsRailSearch value={search} onChange={setSearch} />
            <DocumentsRailBody
              projectKey={projectKey}
              homeActive={view === 'home'}
              activeId={activeId}
              documents={documents}
              loading={live.isLoading}
              failed={live.isLoadingError}
              search={term}
              results={results.data}
              canCreate={canCreate}
              creating={creating}
              onRetry={() => void live.refetch()}
              onCreate={(input) => void create(input)}
            />
            {live.isSuccess && (documents.length > 0 || Boolean(archivedCount)) && (
              <DocumentsRailArchiveLink
                projectKey={projectKey}
                count={archivedCount}
                active={view === 'archive'}
              />
            )}
          </>
        )}
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-35 animate-in bg-black/30 fade-in-0 md:hidden"
          aria-hidden
          onClick={() => onOpenChange(false)}
        />
      )}
    </>
  );
}
