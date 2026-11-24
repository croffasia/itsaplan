'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Calendar, User, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useShell } from '@/context/shellContext';
import { useDocumentsRailView } from '../../hooks/useDocumentsRailView';
import { DOCUMENT_CREATED_RANGES, DOCUMENT_SORTS } from '../../utils/documentList';
import DocumentIconButton from '../DocumentIconButton';
import DocumentsRailFilter from './DocumentsRailFilter';
import DocumentsRailMenuButton from './DocumentsRailMenuButton';

const SORT_LABELS = {
  position: 'manualOrder',
  title: 'nameOrder',
  updated: 'updatedOrder',
  created: 'createdOrder',
} as const;

// The body of the rail's sort and filter popover. Picking an order closes it; a filter keeps it
// open so a second one can be set.
export default function DocumentsRailViewMenu({
  projectKey,
  documents,
  onClose,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
  onClose: () => void;
}) {
  const t = useTranslations('documents');
  const { project } = useShell();
  const view = useDocumentsRailView(projectKey);
  const authorNames = Object.fromEntries(
    (project?.assignees ?? []).map((candidate) => [candidate.userId, candidate.name]),
  );
  const [openFilter, setOpenFilter] = useState<'creator' | 'range' | null>(null);
  const manual = view.sort === 'position';
  const nextDirection = view.direction === 'asc' ? 'desc' : 'asc';
  const directionLabel = nextDirection === 'desc' ? t('sortDescending') : t('sortAscending');
  const name = (id: string) => authorNames[id] ?? t('unknownAuthor');
  const creatorIds = Array.from(
    new Set(documents.flatMap((document) => document.createdByUserId ?? [])),
  ).sort((a, b) => name(a).localeCompare(name(b)));
  const filter = (key: 'creator' | 'range') => ({
    open: openFilter === key,
    onOpenChange: (open: boolean) => setOpenFilter(open ? key : null),
  });

  return (
    <div role="group" aria-label={t('sortAndFilter')}>
      <div className="flex items-center px-2 pt-0.5 text-xs font-medium text-muted-foreground">
        {t('sort')}
        <span className="ms-auto" title={manual ? t('manualOrderNoDirection') : undefined}>
          <DocumentIconButton
            label={directionLabel}
            className="size-6"
            disabled={manual}
            onClick={() => view.setView((previous) => ({ ...previous, direction: nextDirection }))}
          >
            {view.direction === 'asc' ? <ArrowUp /> : <ArrowDown />}
          </DocumentIconButton>
        </span>
      </div>
      {DOCUMENT_SORTS.map((sort) => (
        <DocumentsRailMenuButton
          key={sort}
          checked={view.sort === sort}
          onClick={() => {
            view.setView((previous) => ({ ...previous, sort }));
            onClose();
          }}
        >
          {t(SORT_LABELS[sort])}
        </DocumentsRailMenuButton>
      ))}
      {manual && (
        <p className="px-2 pt-0.5 pb-1.5 text-[13px] text-muted-foreground">{t('dragToReorder')}</p>
      )}

      <div className="-mx-1 my-1 h-px bg-border" />
      <div className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
        {t('filters')}
      </div>
      <DocumentsRailFilter
        icon={<User />}
        label={t('createdBy')}
        value={view.creatorId}
        options={[
          { value: null, label: t('anyone') },
          ...creatorIds.map((id) => ({ value: id, label: name(id) })),
        ]}
        onSelect={(creator) => {
          view.setView((previous) => ({ ...previous, creator }));
          setOpenFilter(null);
        }}
        {...filter('creator')}
      />
      <DocumentsRailFilter
        icon={<Calendar />}
        label={t('createdDate')}
        value={view.range}
        options={DOCUMENT_CREATED_RANGES.map((range) => ({ value: range, label: t(range) }))}
        onSelect={(range) => {
          view.setView((previous) => ({ ...previous, range }));
          setOpenFilter(null);
        }}
        {...filter('range')}
      />
      {view.filterCount > 0 && (
        <>
          <div className="-mx-1 my-1 h-px bg-border" />
          <DocumentsRailMenuButton icon={<X />} onClick={view.clearFilters}>
            {t('clearFilters')}
          </DocumentsRailMenuButton>
        </>
      )}
    </div>
  );
}
