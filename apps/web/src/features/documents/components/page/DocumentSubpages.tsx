'use client';

import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { cn } from '@/lib/utils';
import { documentPath } from '@/utils/paths';
import DocumentIconButton from '../DocumentIconButton';

const ROW =
  'flex h-10 items-center gap-2.5 rounded-md px-2.5 font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

export default function DocumentSubpages({
  projectKey,
  pages,
  onCreate,
}: {
  projectKey: string;
  pages: ProjectDocumentSummary[];
  // Left out when the user may not add a page here.
  onCreate?: () => void;
}) {
  const t = useTranslations('documents');
  const relativeTime = useRelativeTime();
  if (pages.length === 0 && !onCreate) return null;

  return (
    <section className="mt-14" aria-labelledby="document-subpages">
      <div className="mb-2 flex items-center gap-1">
        <h2 id="document-subpages" className="text-[13px] font-medium text-muted-foreground">
          {pages.length > 0 ? t('subpagesCount', { count: pages.length }) : t('subpages')}
        </h2>
        {onCreate && pages.length > 0 && (
          <DocumentIconButton label={t('addSubpage')} className="size-6" onClick={onCreate}>
            <Plus />
          </DocumentIconButton>
        )}
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-3 gap-y-1">
        {pages.length === 0 && onCreate && (
          <li>
            <button
              type="button"
              className={cn(ROW, 'w-full font-normal text-muted-foreground')}
              onClick={onCreate}
            >
              <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
                <Plus className="size-3.5" />
              </span>
              {t('addSubpage')}
            </button>
          </li>
        )}
        {pages.map((page) => (
          <li key={page.id}>
            <Link href={documentPath(projectKey, page.id)} className={ROW}>
              <span
                className="grid size-5 shrink-0 place-items-center text-[15px] leading-none text-muted-foreground"
                aria-hidden
              >
                {page.icon || <FileText className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {page.title.trim() || t('untitled')}
              </span>
              <small className="ms-auto text-xs font-normal whitespace-nowrap text-muted-foreground tabular-nums">
                {relativeTime(page.updatedAt)}
              </small>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
