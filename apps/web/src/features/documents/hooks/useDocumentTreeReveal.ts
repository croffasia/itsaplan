import { useEffect, useRef } from 'react';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useSession } from '@/lib/auth-client';
import { documentAncestors } from '../utils/documentTree';

// Opening or moving a page expands the branches above it once, so a branch collapsed afterwards
// stays collapsed.
export function useDocumentTreeReveal(
  activeId: number | null,
  documents: ProjectDocumentSummary[],
  expand: (documentIds: number[]) => void,
) {
  // The tree state is stored per user, so a write before the session loads is dropped.
  const signedIn = useSession().data != null;
  const revealed = useRef<string | null>(null);

  useEffect(() => {
    const active = documents.find((document) => document.id === activeId);
    if (!active || !signedIn) return;
    const place = `${active.id}:${active.parentId}`;
    if (revealed.current === place) return;
    revealed.current = place;
    const ancestorIds = documentAncestors(active, documents).map((document) => document.id);
    if (ancestorIds.length > 0) expand(ancestorIds);
  }, [activeId, documents, expand, signedIn]);
}
