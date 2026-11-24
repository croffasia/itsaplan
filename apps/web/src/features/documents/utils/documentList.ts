import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';

export const DOCUMENT_SORTS = ['position', 'title', 'updated', 'created'] as const;

export type DocumentSort = (typeof DOCUMENT_SORTS)[number];

export const DOCUMENT_CREATED_RANGES = ['all', 'today', 'week', 'month'] as const;

export type DocumentCreatedRange = (typeof DOCUMENT_CREATED_RANGES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS = { today: 1, week: 7, month: 30 } as const;

export function documentMatchesFilters(
  document: ProjectDocumentSummary,
  creatorId: string | null,
  range: DocumentCreatedRange,
  now: number,
): boolean {
  if (creatorId !== null && document.createdByUserId !== creatorId) return false;
  if (range === 'all') return true;
  const age = now - Date.parse(document.createdAt);
  return age >= 0 && age <= RANGE_DAYS[range] * DAY_MS;
}

// A page whose parent is not in the list shows at the top level. A drop in such a list would
// place the page among the wrong siblings, so the list also says whether every parent is in it.
export function documentGroup(documents: ProjectDocumentSummary[]): {
  documents: ProjectDocumentSummary[];
  reorderSafe: boolean;
} {
  const ids = new Set(documents.map((document) => document.id));
  const orphan = (document: ProjectDocumentSummary) =>
    document.parentId !== null && !ids.has(document.parentId);
  return {
    documents: documents.map((document) =>
      orphan(document) ? { ...document, parentId: null } : document,
    ),
    reorderSafe: !documents.some(orphan),
  };
}

export function compareDocuments(
  a: ProjectDocumentSummary,
  b: ProjectDocumentSummary,
  sortBy: DocumentSort,
  sortDirection: 'asc' | 'desc',
) {
  let result = a.position - b.position || a.id - b.id;
  if (sortBy === 'title') result = a.title.localeCompare(b.title) || a.id - b.id;
  if (sortBy === 'created') {
    result = Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id;
  }
  if (sortBy === 'updated') {
    result = Date.parse(a.updatedAt) - Date.parse(b.updatedAt) || a.id - b.id;
  }
  return sortBy !== 'position' && sortDirection === 'desc' ? -result : result;
}
