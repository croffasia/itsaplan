import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api';
import { cn } from '@/lib/utils';
import { documentPath, documentsPath } from '@/utils/paths';

export default function DocumentBreadcrumbs({
  projectKey,
  projectName,
  ancestors,
  document,
}: {
  projectKey: string;
  projectName: string;
  ancestors: ProjectDocumentSummary[];
  document: ProjectDocumentSummary;
}) {
  const t = useTranslations('documents');

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
      <Link
        href={documentsPath(projectKey)}
        className="shrink-0 rounded-sm px-1 py-0.5 font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t('title')}
      </Link>

      {ancestors.map((ancestor, index) => {
        const nearest = index === ancestors.length - 1;
        const ancestorTitle = ancestor.title.trim() || t('untitled');
        return (
          <span
            key={ancestor.id}
            className={cn(
              'min-w-0 items-center gap-1',
              nearest ? 'hidden sm:flex' : 'hidden xl:flex',
            )}
          >
            <ChevronRight className="size-3 shrink-0 rtl:rotate-180" />
            <Link
              href={documentPath(projectKey, ancestor.id)}
              className="max-w-32 truncate rounded-sm px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              dir="auto"
              title={ancestorTitle}
            >
              {ancestorTitle}
            </Link>
          </span>
        );
      })}

      <ChevronRight className="size-3 shrink-0 rtl:rotate-180" />
      <span
        className="min-w-8 truncate rounded-sm px-1 py-0.5 font-medium text-foreground"
        dir="auto"
        title={document.title.trim() || t('untitled')}
        aria-current="page"
      >
        {document.title.trim() || t('untitled')}
      </span>
    </nav>
  );
}
