'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { usePathname, useSelectedLayoutSegment } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { titlePath, useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { usePermissions } from '@/hooks/usePermissions';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import { useShellRoute } from '@/hooks/useShellRoute';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import DocumentsRail from './components/rail/DocumentsRail';
import DocumentsState from './components/DocumentsState';
import { DocumentsRailProvider } from './context/documentsRail';
import { useDocumentsQuery } from './services/documents.service';

// The Docs layout: the rail beside home, the archive or a page. It stays mounted while the
// user moves between them, so the tree keeps its scroll and state.
export default function DocumentsPage({ children }: { children: ReactNode }) {
  const t = useTranslations('documents');
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = useShellRoute().projectKey ?? '';
  const pathname = usePathname();
  // The segment after /docs: none on home, `archive`, or a page id.
  const segment = useSelectedLayoutSegment();
  const view = segment === null ? 'home' : segment === 'archive' ? 'archive' : 'page';
  const pageId = Number(segment);
  const activeId = view === 'page' && Number.isSafeInteger(pageId) ? pageId : null;
  const canRead = can('documents', 'read');
  const live = useDocumentsQuery(projectKey, '', false, canRead);
  // The drawer belongs to the screen it was opened on, so moving to another screen closes it.
  const [railOpenedAt, setRailOpenedAt] = useState<string | null>(null);
  const railOpen = railOpenedAt === pathname;
  const setRailOpen = useCallback(
    (open: boolean) => setRailOpenedAt(open ? pathname : null),
    [pathname],
  );
  const rail = usePersistedOpen('docs-rail');
  useDocumentTitle(titlePath(project?.project.name, t('title')), 'section');
  useLiveRefresh({
    scope: project ? revScope.documents(project.project.id) : null,
    targets: [qk.documentListsForProject(projectKey)],
  });

  if (!project) {
    return (
      <div className="flex min-h-0 flex-1">
        <div className="w-68 shrink-0 bg-rail max-md:hidden" />
      </div>
    );
  }

  return (
    <DocumentsRailProvider
      open={railOpen}
      setOpen={setRailOpen}
      shown={rail.open}
      toggleShown={rail.toggle}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <DocumentsRail
          projectKey={projectKey}
          view={view}
          activeId={activeId}
          canRead={canRead}
          open={railOpen}
          shown={rail.open}
          onOpenChange={setRailOpen}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {!canRead ? (
            <DocumentsState projectKey={projectKey} kind="noAccess" />
          ) : live.isLoadingError && view !== 'page' ? (
            <DocumentsState
              projectKey={projectKey}
              kind="failed"
              onRetry={() => void live.refetch()}
            />
          ) : (
            children
          )}
        </div>
      </div>
    </DocumentsRailProvider>
  );
}
