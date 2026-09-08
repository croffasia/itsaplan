// Paging. A list route either pages or answers with the whole list, never both, so a
// paged read always names its window and a whole-list read is a call of its own
// (listSkillOptions, listConfiguredToolOptions, listNoteBoards, ...).

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// The next page of a list read as "show more": there is one while the pages loaded so
// far do not cover the total. What every useInfiniteQuery over a paged route passes as
// getNextPageParam.
export function nextPageParam<T>(last: Page<T>): number | undefined {
  return last.page * last.pageSize < last.total ? last.page + 1 : undefined;
}

// The query string a paged read takes: the window, plus whatever filters the list
// narrows by. A filter left empty is left out.
export function pageQuery(
  params: PageParams,
  filters: Record<string, string | undefined> = {},
): string {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value) qs.set(key, value);
  }
  return `?${qs}`;
}
