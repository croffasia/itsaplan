import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { compareDocuments } from './documentList';

export const HOME_LIST_LIMIT = 8;

export interface DocumentHomeCard {
  page: ProjectDocumentSummary;
  children: ProjectDocumentSummary[];
}

const byPosition = (a: ProjectDocumentSummary, b: ProjectDocumentSummary) =>
  compareDocuments(a, b, 'position', 'asc');

// What the Docs home shows, from the list of active pages the viewer can read.
export function documentHomeSections(documents: ProjectDocumentSummary[]): {
  pinned: DocumentHomeCard[];
  favorites: ProjectDocumentSummary[];
  recent: ProjectDocumentSummary[];
} {
  const childrenOf = new Map<number, ProjectDocumentSummary[]>();
  for (const document of documents) {
    if (document.parentId === null) continue;
    childrenOf.set(document.parentId, [...(childrenOf.get(document.parentId) ?? []), document]);
  }

  return {
    pinned: documents
      .filter((document) => document.isPinned)
      .sort(byPosition)
      .map((page) => ({ page, children: (childrenOf.get(page.id) ?? []).sort(byPosition) })),
    favorites: documents.filter((document) => document.isFavorite).sort(byPosition),
    recent: [...documents]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id - a.id)
      .slice(0, HOME_LIST_LIMIT),
  };
}
