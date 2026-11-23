import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';

export const DOCUMENT_LIST_TABS = ['favorites', 'public', 'private', 'archived'] as const;

export type DocumentListTab = (typeof DOCUMENT_LIST_TABS)[number];

export type DocumentListView = 'home' | 'tree';

export type DocumentSort = 'position' | 'title' | 'created' | 'updated';

export function documentBelongsToTab(document: ProjectDocumentSummary, tab: DocumentListTab) {
  if (tab === 'archived') return true;
  if (tab === 'favorites') return document.isFavorite;
  return tab === 'private' ? document.isPrivate : !document.isPrivate;
}

// Pinned pages come first among their siblings in every order.
export function compareDocuments(
  a: ProjectDocumentSummary,
  b: ProjectDocumentSummary,
  sortBy: DocumentSort,
  sortDirection: 'asc' | 'desc',
) {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
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
