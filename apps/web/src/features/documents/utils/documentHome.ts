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
  pinned: ProjectDocumentSummary[];
  cards: DocumentHomeCard[];
  favorites: ProjectDocumentSummary[];
  recent: ProjectDocumentSummary[];
} {
  const ids = new Set(documents.map((document) => document.id));
  const childrenOf = new Map<number | null, ProjectDocumentSummary[]>();
  for (const document of documents) {
    // A page whose parent is not in the list is shown at the top level, as the tree does.
    const parentId =
      document.parentId !== null && ids.has(document.parentId) ? document.parentId : null;
    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), document]);
  }
  for (const siblings of childrenOf.values()) siblings.sort(byPosition);

  return {
    pinned: documents.filter((document) => document.isPinned).sort(byPosition),
    cards: (childrenOf.get(null) ?? []).map((page) => ({
      page,
      children: childrenOf.get(page.id) ?? [],
    })),
    favorites: documents.filter((document) => document.isFavorite).sort(byPosition),
    recent: [...documents]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id - a.id)
      .slice(0, HOME_LIST_LIMIT),
  };
}
