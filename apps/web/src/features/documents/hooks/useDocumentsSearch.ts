import { useCallback } from 'react';
import { useDocumentNavigation } from '@/hooks/useDocumentNavigation';

const defaults = { search: '' };

// The rail's search text, kept for the session. A new page clears it, so the page shows in the tree.
export function useDocumentsSearch(projectKey: string) {
  const [value, setValue] = useDocumentNavigation(projectKey, 'list', defaults);
  const setSearch = useCallback((search: string) => setValue({ search }), [setValue]);
  return [value.search, setSearch] as const;
}
