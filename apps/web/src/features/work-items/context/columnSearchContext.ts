import { createContext, useContext } from 'react';
import type { useColumnSearch } from '../hooks/useColumnSearch';

export const ColumnSearchContext = createContext<ReturnType<typeof useColumnSearch> | null>(null);

export function useColumnSearchContext() {
  const context = useContext(ColumnSearchContext);
  if (!context) throw new Error('Column search requires its board provider');
  return context;
}
