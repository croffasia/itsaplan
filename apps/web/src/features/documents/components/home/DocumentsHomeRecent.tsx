'use client';

import { useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRecentDocuments } from '@/hooks/useDocumentNavigation';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import {
  documentHomeDays,
  documentHomeOpened,
  documentHomeUpdated,
  type DocumentHomeDay,
  type DocumentHomeRecentItem,
} from '../../utils/documentHome';
import DocumentsHomeRecentRow from './DocumentsHomeRecentRow';

const DAY_LABELS = {
  today: 'home.today',
  yesterday: 'home.yesterday',
  week: 'home.last7Days',
  earlier: 'home.earlier',
} as const satisfies Record<DocumentHomeDay, string>;

export default function DocumentsHomeRecent({
  projectKey,
  documents,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
}) {
  const t = useTranslations('documents');
  const { visits } = useRecentDocuments(projectKey);
  const opened = useMemo(() => documentHomeOpened(documents, visits), [documents, visits]);
  const updated = useMemo(() => documentHomeUpdated(documents), [documents]);
  const list = (items: DocumentHomeRecentItem[], showAuthor: boolean) =>
    documentHomeDays(items, new Date()).map((group) => (
      <div key={group.day} className="mt-4 first:mt-0">
        <h4 className="mb-1 px-2 text-xs font-medium text-muted-foreground">
          {t(DAY_LABELS[group.day])}
        </h4>
        <ul className="flex flex-col">
          {group.items.map((item) => (
            <li key={item.document.id}>
              <DocumentsHomeRecentRow
                projectKey={projectKey}
                documents={documents}
                item={item}
                showAuthor={showAuthor}
              />
            </li>
          ))}
        </ul>
      </div>
    ));

  const column = (id: string, title: string, body: ReactNode) => (
    <section aria-labelledby={id} className="min-w-0">
      <h3 id={id} className="mb-2 px-2 text-sm font-medium">
        {title}
      </h3>
      {body}
    </section>
  );

  return (
    <section aria-labelledby="documents-home-recent" className="@container">
      <h2 id="documents-home-recent" className="mb-3 text-[13px] font-medium text-muted-foreground">
        {t('home.recent')}
      </h2>
      <div className="grid gap-x-10 gap-y-8 @3xl:grid-cols-2">
        {column(
          'documents-home-opened',
          t('home.openedByMe'),
          opened.length > 0 ? (
            list(opened, false)
          ) : (
            <p className="px-2 text-sm text-muted-foreground">{t('home.openedEmpty')}</p>
          ),
        )}
        {column('documents-home-updated', t('home.updated'), list(updated, true))}
      </div>
    </section>
  );
}
