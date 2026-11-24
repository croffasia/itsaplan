'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { documentPath } from '@/utils/paths';
import DocumentsRailEmpty from './DocumentsRailEmpty';
import DocumentsRailIcon from '../DocumentsRailIcon';
import DocumentsRailLink from './DocumentsRailLink';

// The API matches titles and page text.
export default function DocumentsRailResults({
  projectKey,
  query,
  results,
  activeId,
  canCreate,
  creating,
  onCreate,
}: {
  projectKey: string;
  query: string;
  results: ProjectDocumentSummary[] | undefined;
  activeId: number | null;
  canCreate: boolean;
  creating: boolean;
  onCreate: (title: string) => void;
}) {
  const t = useTranslations('documents');

  if (!results) {
    return <p className="py-4 ps-6.5 pe-3 text-[13px] text-muted-foreground">{t('searching')}</p>;
  }
  if (results.length === 0) {
    return (
      <DocumentsRailEmpty
        title={t('noResults')}
        description={t('noResultsHint')}
        action={
          canCreate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 max-w-full px-2.5 text-[13px]"
              disabled={creating}
              onClick={() => onCreate(query)}
            >
              <Plus />
              <span className="truncate" dir="auto">
                {t('newPageNamed', { title: query })}
              </span>
            </Button>
          )
        }
      />
    );
  }
  return (
    <div>
      <p className="flex h-7 items-center ps-6.5 text-xs font-medium text-muted-foreground">
        {t('resultCount', { count: results.length })}
      </p>
      {results.map((result) => (
        <DocumentsRailLink
          key={result.id}
          href={documentPath(projectKey, result.id)}
          active={result.id === activeId}
          icon={<DocumentsRailIcon icon={result.icon} />}
          title={result.title.trim() || t('untitled')}
        />
      ))}
    </div>
  );
}
