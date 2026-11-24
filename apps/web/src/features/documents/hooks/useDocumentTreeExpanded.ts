import { useCallback, useMemo } from 'react';
import { useDocumentNavigation } from '@/hooks/useDocumentNavigation';

const defaults: { expanded: number[] } = { expanded: [] };

// The expanded branches of the page tree, kept for the session.
export function useDocumentTreeExpanded(projectKey: string) {
  const [state, setState] = useDocumentNavigation(projectKey, 'tree', defaults);
  const expanded = useMemo(() => new Set(state.expanded), [state.expanded]);

  const expand = useCallback(
    (documentIds: number[]) =>
      setState((previous) => ({
        expanded: [...new Set([...previous.expanded, ...documentIds])],
      })),
    [setState],
  );

  const toggle = (documentId: number) =>
    setState((previous) => ({
      expanded: previous.expanded.includes(documentId)
        ? previous.expanded.filter((id) => id !== documentId)
        : [...previous.expanded, documentId],
    }));

  const collapseAll = () => setState(defaults);

  return { expanded, expand, toggle, collapseAll };
}
