'use client';

import { useState } from 'react';
import { FileText, Lock } from 'lucide-react';
import type { ProjectDocumentSummary } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useTranslations } from 'next-intl';
import { useDocumentsQuery } from '../services/documents.service';

export default function DocumentPickerDialog({
  projectKey,
  linkedDocumentIds,
  onPick,
  onClose,
}: {
  projectKey: string;
  linkedDocumentIds: Set<number>;
  onPick: (document: ProjectDocumentSummary) => void;
  onClose: () => void;
}) {
  const t = useTranslations('documents');
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 250);
  const documents = useDocumentsQuery(projectKey, debounced);
  const choices = (documents.data ?? []).filter((document) => !linkedDocumentIds.has(document.id));

  return (
    <CommandDialog
      open
      onOpenChange={onClose}
      shouldFilter={false}
      title={t('linkWorkItem.selectDocument')}
      description={t('linkWorkItem.searchDocuments')}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('linkWorkItem.searchDocuments')}
      />
      <CommandList>
        <CommandEmpty>
          {documents.isLoading ? t('linkWorkItem.loading') : t('linkWorkItem.noDocuments')}
        </CommandEmpty>
        <CommandGroup>
          {choices.map((document) => (
            <CommandItem
              key={document.id}
              value={String(document.id)}
              onSelect={() => onPick(document)}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-muted/30 text-sm">
                {document.icon || <FileText className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {document.title.trim() || t('untitled')}
              </span>
              {document.isPrivate && <Lock className="size-3.5" aria-label={t('privatePage')} />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
