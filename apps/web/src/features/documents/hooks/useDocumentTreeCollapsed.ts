import { useEffect, useMemo, useRef } from 'react';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { useDocumentNavigation } from '@/hooks/useDocumentNavigation';
import { documentAncestors } from '../utils/documentTree';

const defaults: { collapsed: number[] } = { collapsed: [] };

// The collapsed branches of the page tree, kept for the session. Opening a page expands the
// branches above it once, so a branch collapsed afterwards stays collapsed.
export function useDocumentTreeCollapsed(
  projectKey: string,
  activeId: number | null,
  documents: ProjectDocumentSummary[],
) {
  const [state, setState] = useDocumentNavigation(projectKey, 'tree', defaults);
  const collapsed = useMemo(() => new Set(state.collapsed), [state.collapsed]);
  const revealed = useRef<number | null>(null);

  useEffect(() => {
    const active = documents.find((document) => document.id === activeId);
    if (!active || revealed.current === active.id) return;
    revealed.current = active.id;
    const ancestorIds = documentAncestors(active, documents).map((document) => document.id);
    if (ancestorIds.some((id) => collapsed.has(id))) {
      setState((previous) => ({
        collapsed: previous.collapsed.filter((id) => !ancestorIds.includes(id)),
      }));
    }
  }, [activeId, collapsed, documents, setState]);

  const toggle = (documentId: number) =>
    setState((previous) => ({
      collapsed: previous.collapsed.includes(documentId)
        ? previous.collapsed.filter((id) => id !== documentId)
        : [...previous.collapsed, documentId],
    }));

  return { collapsed, toggle };
}
