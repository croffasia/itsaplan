'use client';

import { CornerLeftUp, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useDocumentsQuery } from '../services/documents.service';
import {
  documentMoveParents,
  documentMoveToParent,
  type DocumentPlacement,
} from '../utils/documentMove';

export default function DocumentMoveDialog({
  projectKey,
  documentId,
  onPick,
  onClose,
}: {
  projectKey: string;
  documentId: number;
  onPick: (move: DocumentPlacement, parent: ProjectDocumentSummary | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations('documents');
  const documents = useDocumentsQuery(projectKey);
  const all = documents.data ?? [];
  // The row of a filtered list can show a page without its parent, so the page
  // is read from the whole list.
  const source = all.find((document) => document.id === documentId);
  const name = (document: ProjectDocumentSummary) => document.title.trim() || t('untitled');
  const pick = (parent: ProjectDocumentSummary | null) => {
    if (source) onPick(documentMoveToParent(source, parent?.id ?? null, all), parent);
  };

  return (
    <CommandDialog
      open
      onOpenChange={onClose}
      title={t('moveTo')}
      description={t('moveToDescription')}
    >
      <CommandInput placeholder={t('search')} />
      <CommandList>
        <CommandEmpty>
          {documents.isLoading ? t('linkWorkItem.loading') : t('noResults')}
        </CommandEmpty>
        {source && (
          <CommandGroup heading={t('movePage', { title: name(source) })}>
            {source.parentId !== null && (
              <CommandItem value="top-level" keywords={[t('topLevel')]} onSelect={() => pick(null)}>
                <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-muted/30">
                  <CornerLeftUp className="size-3.5 rtl:-scale-x-100" />
                </span>
                {t('topLevel')}
              </CommandItem>
            )}
            {documentMoveParents(source, all).map(({ page, ancestors }) => (
              <CommandItem
                key={page.id}
                value={String(page.id)}
                keywords={[name(page)]}
                onSelect={() => pick(page)}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-muted/30 text-sm">
                  {page.icon || <FileText className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate" dir="auto">
                    {name(page)}
                  </span>
                  {ancestors.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground" dir="auto">
                      {ancestors.map(name).join(' / ')}
                    </span>
                  )}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
