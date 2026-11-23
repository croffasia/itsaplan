import { useDocumentNavigation } from '@/hooks/useDocumentNavigation';
import {
  DOCUMENT_CREATED_RANGES,
  DOCUMENT_SORTS,
  type DocumentCreatedRange,
  type DocumentSort,
} from '../utils/documentList';

const defaults: {
  sort: DocumentSort;
  direction: 'asc' | 'desc';
  creator: string | null;
  range: DocumentCreatedRange;
  scroll: number;
} = { sort: 'position', direction: 'asc', creator: null, range: 'all', scroll: 0 };

// The rail's sort, filters and scroll, kept for the session so they survive a reload.
export function useDocumentsRailView(projectKey: string) {
  const [view, setView] = useDocumentNavigation(projectKey, 'index', defaults);
  const sort = DOCUMENT_SORTS.includes(view.sort) ? view.sort : 'position';
  const range = DOCUMENT_CREATED_RANGES.includes(view.range) ? view.range : 'all';
  return {
    sort,
    direction: view.direction === 'desc' ? ('desc' as const) : ('asc' as const),
    creatorId: view.creator,
    range,
    filterCount: Number(view.creator !== null) + Number(range !== 'all'),
    scroll: view.scroll,
    setView,
    clearFilters: () => setView((previous) => ({ ...previous, creator: null, range: 'all' })),
  };
}
