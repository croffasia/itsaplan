import Link from 'next/link';
import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { Skeleton } from '@/components/ui/skeleton';
import { documentPath, documentsArchivePath, documentsPath } from '@/utils/paths';
import { documentChildren } from '../../utils/documentTree';
import DocumentBreadcrumbMenu from './DocumentBreadcrumbMenu';

const separator = (
  <ChevronRight
    className="size-3.5 shrink-0 text-muted-foreground/60 max-md:hidden rtl:rotate-180"
    aria-hidden
  />
);

// A narrow screen keeps only the open page: the Docs rail shows where it sits.
export default function DocumentBreadcrumbs({
  projectKey,
  projectName,
  document,
  ancestors = [],
  documents,
  canCreate,
  loading = false,
  onCreate,
}: {
  projectKey: string;
  projectName?: string;
  // Left out on a page that did not load.
  document?: ProjectDocumentSummary;
  ancestors?: ProjectDocumentSummary[];
  documents: ProjectDocumentSummary[];
  canCreate: boolean;
  loading?: boolean;
  onCreate: (parentId: number | null, isPrivate: boolean) => void;
}) {
  const t = useTranslations('documents');
  const archived = document?.archivedAt != null;
  const activeIds = new Set([
    ...ancestors.map((page) => page.id),
    ...(document ? [document.id] : []),
  ]);

  return (
    <nav
      className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden text-[13px]"
      aria-label={t('breadcrumb')}
    >
      {projectName && (
        <>
          <span
            className="max-w-40 truncate px-1.5 py-0.5 text-muted-foreground max-md:hidden"
            dir="auto"
          >
            {projectName}
          </span>
          {separator}
        </>
      )}
      {archived ? (
        <Link
          href={documentsArchivePath(projectKey)}
          className="shrink-0 rounded-sm px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-md:hidden"
        >
          {t('archivedPages')}
        </Link>
      ) : (
        <span className="contents max-md:hidden">
          <DocumentBreadcrumbMenu
            projectKey={projectKey}
            label={t('title')}
            href={documentsPath(projectKey)}
            pages={documentChildren(null, documents).filter(
              (page) => page.visibility !== 'private',
            )}
            activeIds={activeIds}
            createLabel={t('newDocument')}
            onCreate={canCreate ? () => onCreate(null, false) : undefined}
          />
        </span>
      )}
      {loading && (
        <>
          {separator}
          <Skeleton className="h-3.5 w-30" />
        </>
      )}
      {document && (
        <>
          {separator}
          {!archived &&
            ancestors.map((ancestor) => (
              <Fragment key={ancestor.id}>
                <span className="contents max-md:hidden">
                  <DocumentBreadcrumbMenu
                    projectKey={projectKey}
                    label={ancestor.title.trim() || t('untitled')}
                    href={documentPath(projectKey, ancestor.id)}
                    pages={documentChildren(ancestor.id, documents)}
                    activeIds={activeIds}
                    createLabel={t('addSubpage')}
                    onCreate={
                      canCreate && ancestor.archivedAt === null
                        ? () => onCreate(ancestor.id, ancestor.isPrivate)
                        : undefined
                    }
                  />
                </span>
                {separator}
              </Fragment>
            ))}
          <Link
            href={documentPath(projectKey, document.id)}
            aria-current="page"
            className="min-w-0 truncate rounded-sm px-1.5 py-0.5 font-medium text-foreground transition-colors hover:bg-accent"
            dir="auto"
          >
            {document.title.trim() || t('untitled')}
          </Link>
        </>
      )}
    </nav>
  );
}
