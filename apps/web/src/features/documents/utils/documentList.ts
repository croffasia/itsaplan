import type { ProjectDocumentSummary } from '@/lib/api';

export const DOCUMENT_LIST_TABS = ['favorites', 'public', 'private', 'archived'] as const;

export type DocumentListTab = (typeof DOCUMENT_LIST_TABS)[number];

export function documentBelongsToTab(document: ProjectDocumentSummary, tab: DocumentListTab) {
  if (tab === 'archived') return true;
  if (tab === 'favorites') return document.isFavorite;
  return tab === 'private' ? document.isPrivate : !document.isPrivate;
}
