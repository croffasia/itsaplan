'use client';

import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpenText,
  Check,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMoveDocument, useSetDocumentFavorite } from '../services/documents.service';
import { DOCUMENT_LIST_TABS, type DocumentListTab } from '../utils/documentList';
import DocumentTree, { type DocumentSort } from './DocumentTree';

const SORTS = [
  'position',
  'title',
  'created',
  'updated',
] as const satisfies readonly DocumentSort[];
export type { DocumentListTab } from '../utils/documentList';

export default function DocumentsIndex({
  projectKey,
  documents,
  tab,
  search,
  searching,
  loading,
  failed,
  canCreate,
  canEdit,
  authorNames,
  reorderSafe,
  creating,
  onSearchChange,
  onTabChange,
  onCreate,
  onRetry,
}: {
  projectKey: string;
  documents: ProjectDocumentSummary[];
  tab: DocumentListTab;
  search: string;
  searching: boolean;
  loading: boolean;
  failed: boolean;
  canCreate: boolean;
  canEdit: boolean;
  authorNames: Record<string, string>;
  reorderSafe: boolean;
  creating: boolean;
  onSearchChange: (value: string) => void;
  onTabChange: (tab: DocumentListTab) => void;
  onCreate: (parentId: number | null) => void;
  onRetry: () => void;
}) {
  const t = useTranslations('documents');
  const move = useMoveDocument(projectKey);
  const favorite = useSetDocumentFavorite(projectKey);
  const [sort, setSort] = useState<DocumentSort>('position');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [createdRange, setCreatedRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const creatorIds = Array.from(
    new Set(
      documents.flatMap((document) => (document.createdByUserId ? [document.createdByUserId] : [])),
    ),
  ).sort((a, b) => (authorNames[a] ?? a).localeCompare(authorNames[b] ?? b));
  const now = Date.now();
  const filteredDocuments = documents.filter((document) => {
    if (creatorId !== null && document.createdByUserId !== creatorId) return false;
    if (createdRange === 'all') return true;

    const age = now - Date.parse(document.createdAt);
    const limit =
      createdRange === 'today'
        ? 24 * 60 * 60 * 1000
        : createdRange === 'week'
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;
    return age >= 0 && age <= limit;
  });
  const filteredIds = new Set(filteredDocuments.map((document) => document.id));
  const displayDocuments = filteredDocuments.map((document) =>
    document.parentId !== null && !filteredIds.has(document.parentId)
      ? { ...document, parentId: null }
      : document,
  );
  const filterCount = Number(creatorId !== null) + Number(createdRange !== 'all');
  const sortLabel = {
    position: t('manualOrder'),
    title: t('nameOrder'),
    updated: t('updatedOrder'),
    created: t('createdOrder'),
  }[sort];
  const tabLabel = (value: DocumentListTab) =>
    value === 'favorites'
      ? t('favoritePages')
      : value === 'public'
        ? t('publicPages')
        : value === 'private'
          ? t('privatePages')
          : t('archivedPages');

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b bg-background/95 px-4 backdrop-blur md:px-6">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-md bg-foreground text-background">
              <BookOpenText className="size-3.5" />
            </div>
            <div className="flex min-w-0 items-baseline gap-2">
              <h1 className="truncate text-sm font-semibold tracking-[-0.01em]">{t('title')}</h1>
              {!loading && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {documents.length}
                </span>
              )}
            </div>
          </div>
          {canCreate && (
            <Button
              type="button"
              size="sm"
              className="h-8 px-2.5 shadow-none"
              disabled={creating}
              onClick={() => onCreate(null)}
            >
              {creating ? <LoaderCircle className="animate-spin" /> : <Plus />}
              <span className="hidden sm:inline">{t('newDocument')}</span>
            </Button>
          )}
        </div>
      </header>

      <div className="shrink-0 border-b px-4 md:px-6">
        <div
          className="mx-auto flex w-full max-w-6xl items-center gap-6 overflow-x-auto"
          role="tablist"
        >
          {DOCUMENT_LIST_TABS.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              className={cn(
                'relative h-10 shrink-0 px-0.5 text-[13px] font-medium text-muted-foreground transition-colors outline-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-center after:scale-x-0 after:bg-foreground after:transition-transform hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring',
                tab === option && 'text-foreground after:scale-x-100',
              )}
              onClick={() => onTabChange(option)}
            >
              {tabLabel(option)}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 px-4 py-3 md:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-1.5">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              className="h-8 border-transparent bg-muted/55 ps-8 text-[13px] shadow-none hover:bg-muted focus-visible:bg-background"
              placeholder={t('search')}
              aria-label={t('search')}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground"
                aria-label={t('sort')}
              >
                <ArrowUpDown />
                <span className="hidden md:inline">{sortLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {SORTS.map((option) => (
                <DropdownMenuItem key={option} onSelect={() => setSort(option)}>
                  <Check className={cn('me-1', option !== sort && 'invisible')} />
                  {option === 'position'
                    ? t('manualOrder')
                    : option === 'title'
                      ? t('nameOrder')
                      : option === 'created'
                        ? t('createdOrder')
                        : t('updatedOrder')}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            disabled={sort === 'position'}
            aria-label={sortDirection === 'asc' ? t('sortDescending') : t('sortAscending')}
            onClick={() => setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'))}
          >
            {sortDirection === 'asc' ? <ArrowUp /> : <ArrowDown />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant={filterCount > 0 ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2 text-muted-foreground"
                aria-label={t('filters')}
              >
                <SlidersHorizontal />
                <span className="hidden md:inline">{t('filters')}</span>
                {filterCount > 0 && (
                  <span className="min-w-4 rounded-full bg-foreground px-1 text-center text-[10px] leading-4 text-background tabular-nums">
                    {filterCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{t('createdBy')}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuItem onSelect={() => setCreatorId(null)}>
                    <Check className={cn('me-1', creatorId !== null && 'invisible')} />
                    {t('anyone')}
                  </DropdownMenuItem>
                  {creatorIds.map((id) => (
                    <DropdownMenuItem key={id} onSelect={() => setCreatorId(id)}>
                      <Check className={cn('me-1', creatorId !== id && 'invisible')} />
                      <span className="truncate" dir="auto">
                        {authorNames[id] ?? t('unknownAuthor')}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{t('createdDate')}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {(['all', 'today', 'week', 'month'] as const).map((range) => (
                    <DropdownMenuItem key={range} onSelect={() => setCreatedRange(range)}>
                      <Check className={cn('me-1', createdRange !== range && 'invisible')} />
                      {t(range)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {filterCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      setCreatorId(null);
                      setCreatedRange('all');
                    }}
                  >
                    {t('clearFilters')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 md:px-6">
        <div className="mx-auto w-full max-w-6xl">
          {loading ? (
            <div className="space-y-1 py-1" aria-hidden>
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-[92%] rounded-md" />
              <Skeleton className="h-9 w-[85%] rounded-md" />
            </div>
          ) : failed ? (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <div className="mb-3 grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
                <RefreshCw className="size-4" />
              </div>
              <p className="text-sm font-medium">{t('loadFailed')}</p>
              <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw />
                {t('reload')}
              </Button>
            </div>
          ) : (
            <DocumentTree
              projectKey={projectKey}
              documents={displayDocuments}
              activeId={null}
              searching={searching}
              sortBy={sort}
              sortDirection={sortDirection}
              canCreate={canCreate}
              reorderEnabled={
                canEdit &&
                tab !== 'favorites' &&
                tab !== 'archived' &&
                !searching &&
                sort === 'position' &&
                filterCount === 0 &&
                reorderSafe &&
                !move.isPending
              }
              favoritePending={favorite.isPending}
              onCreate={onCreate}
              onMove={(input) => move.mutate(input)}
              onFavoriteChange={(documentId, isFavorite) =>
                favorite.mutate({ documentId, isFavorite })
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
