'use client';

import type { ReactNode } from 'react';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import DocumentsHomeLink from './DocumentsHomeLink';

export default function DocumentsHomeList({
  projectKey,
  title,
  documents,
  detail,
  empty,
  footer,
}: {
  projectKey: string;
  title: string;
  documents: ProjectDocumentSummary[];
  detail?: (document: ProjectDocumentSummary) => ReactNode;
  empty?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col">
      <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{title}</h2>
      {documents.length > 0 ? (
        <ul>
          {documents.map((document) => (
            <li key={document.id}>
              <DocumentsHomeLink projectKey={projectKey} document={document}>
                {detail?.(document)}
              </DocumentsHomeLink>
            </li>
          ))}
        </ul>
      ) : (
        empty
      )}
      {footer}
    </section>
  );
}
