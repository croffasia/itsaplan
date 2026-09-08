'use client';

import { useCallback, useState } from 'react';
import type { PageParams } from '@/lib/api/core/paging';

// What a paged list opens with, until the reader picks another size.
export const DEFAULT_PAGE_SIZE = 10;

export interface Paging {
  params: PageParams;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  reset: () => void;
  slice: <T>(items: T[]) => T[];
}

// The window every server-paged list reads with, and the moves that change it.
// Narrowing the list — a search term, a tab, a filter — goes back to the first page:
// the page the reader was on may hold nothing under the new filter. That is what
// `reset` is for, and picking another size does it too. `slice` cuts the window out of
// a list that arrives whole, for the screens that read one.
export function usePaging(initialPageSize = DEFAULT_PAGE_SIZE): Paging {
  const [params, setParams] = useState<PageParams>({ page: 1, pageSize: initialPageSize });

  const setPage = useCallback((page: number) => setParams((current) => ({ ...current, page })), []);
  const setPageSize = useCallback((pageSize: number) => setParams({ page: 1, pageSize }), []);
  const reset = useCallback(() => setParams((current) => ({ ...current, page: 1 })), []);
  const slice = useCallback(
    <T>(items: T[]) =>
      items.slice((params.page - 1) * params.pageSize, params.page * params.pageSize),
    [params],
  );

  return { params, setPage, setPageSize, reset, slice };
}
