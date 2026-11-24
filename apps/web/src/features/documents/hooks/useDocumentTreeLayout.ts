import { useMemo } from 'react';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { compareDocuments, type DocumentSort } from '../utils/documentList';

// The pages grouped under their parents in display order, and the whole tree flattened in that
// order. A page whose parent is not in the list sits at the top level.
export function useDocumentTreeLayout(
  documents: ProjectDocumentSummary[],
  sortBy: DocumentSort,
  sortDirection: 'asc' | 'desc',
) {
  return useMemo(() => {
    const byId = new Map(documents.map((item) => [item.id, item]));
    const byParent = new Map<number | null, ProjectDocumentSummary[]>();
    for (const item of documents) {
      const parentId = item.parentId !== null && byId.has(item.parentId) ? item.parentId : null;
      const siblings = byParent.get(parentId) ?? [];
      siblings.push(item);
      byParent.set(parentId, siblings);
    }
    for (const siblings of byParent.values()) {
      siblings.sort((a, b) => compareDocuments(a, b, sortBy, sortDirection));
    }

    const ordered: ProjectDocumentSummary[] = [];
    const visited = new Set<number>();
    const visit = (parentId: number | null) => {
      for (const item of byParent.get(parentId) ?? []) {
        if (visited.has(item.id)) continue;
        visited.add(item.id);
        ordered.push(item);
        visit(item.id);
      }
    };
    visit(null);
    for (const item of documents) {
      if (!visited.has(item.id)) ordered.push(item);
    }
    return { byId, byParent, ordered };
  }, [documents, sortBy, sortDirection]);
}
