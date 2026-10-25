import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { cn } from '@/lib/utils';
import { documentPath, documentsPath } from '@/utils/paths';
import { documentChildren } from '../utils/documentTree';
import DocumentBreadcrumbMenu from './DocumentBreadcrumbMenu';

export default function DocumentBreadcrumbs({
  projectKey,
  projectName,
  ancestors,
  document,
  documents,
  canCreate,
  onCreate,
}: {
  projectKey: string;
  projectName: string;
  ancestors: ProjectDocumentSummary[];
  document: ProjectDocumentSummary;
  documents: ProjectDocumentSummary[];
  canCreate: boolean;
  onCreate: (parentId: number | null, isPrivate: boolean) => void;
}) {
  const t = useTranslations('documents');
  const title = document.title.trim() || t('untitled');
  const children = documentChildren(document.id, documents);

  return (
    <nav
      className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[12px] text-muted-foreground"
      aria-label={t('treeLabel')}
    >
      <span
        className="hidden max-w-28 shrink-0 truncate font-medium lg:inline"
        dir="auto"
        title={projectName}
      >
        {projectName}
      </span>
      <ChevronRight className="hidden size-3 shrink-0 lg:block rtl:rotate-180" />
      <DocumentBreadcrumbMenu
        projectKey={projectKey}
        label={t('title')}
        href={documentsPath(projectKey)}
        pages={documentChildren(null, documents)}
        currentId={document.id}
        createLabel={t('newDocument')}
        onCreate={canCreate ? () => onCreate(null, false) : undefined}
        className="shrink-0 font-medium"
      />

      {ancestors.map((ancestor, index) => {
        const nearest = index === ancestors.length - 1;
        return (
          <span
            key={ancestor.id}
            className={cn(
              'min-w-0 items-center gap-1',
              nearest ? 'hidden sm:flex' : 'hidden xl:flex',
            )}
          >
            <ChevronRight className="size-3 shrink-0 rtl:rotate-180" />
            <DocumentBreadcrumbMenu
              projectKey={projectKey}
              label={ancestor.title.trim() || t('untitled')}
              href={documentPath(projectKey, ancestor.id)}
              pages={documentChildren(ancestor.id, documents)}
              currentId={document.id}
              createLabel={t('addSubpage')}
              onCreate={
                canCreate && ancestor.archivedAt === null
                  ? () => onCreate(ancestor.id, ancestor.isPrivate)
                  : undefined
              }
              className="max-w-32"
            />
          </span>
        );
      })}

      <ChevronRight className="size-3 shrink-0 rtl:rotate-180" />
      {children.length > 0 ? (
        <DocumentBreadcrumbMenu
          projectKey={projectKey}
          label={title}
          pages={children}
          currentId={document.id}
          createLabel={t('addSubpage')}
          onCreate={
            canCreate && document.archivedAt === null
              ? () => onCreate(document.id, document.isPrivate)
              : undefined
          }
          current
          className="min-w-8"
        />
      ) : (
        <span
          className="min-w-8 truncate rounded-sm px-1 py-0.5 font-medium text-foreground"
          dir="auto"
          title={title}
          aria-current="page"
        >
          {title}
        </span>
      )}
    </nav>
  );
}
