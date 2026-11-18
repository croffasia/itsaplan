import { t, type TSchema } from 'elysia';

// What a page holds when the caller names no size.
export const DEFAULT_PAGE_SIZE = 25;

// The page/pageSize pair a paged list route takes, and the envelope it answers with.
// Spread the fields into the route's own query schema:
//
//   export const listQuery = t.Object({ search: t.Optional(t.String()), ...pageQueryFields });
//   export const ListPageResponse = pageResponse(ThingResponse);
//
// A route either pages or answers with the whole list — never both, so a caller never
// has to read the query to know which one it got. A list a picker needs entire gets an
// `/options` route of its own.
export const pageQueryFields = {
  page: t.Optional(t.Numeric({ minimum: 1, description: 'Page number. Default 1.' })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100, description: 'Default 25.' })),
};

export const pageResponse = <T extends TSchema>(item: T) =>
  t.Object({
    items: t.Array(item),
    total: t.Number(),
    page: t.Number(),
    pageSize: t.Number(),
  });

// The envelope a paged route answers with, around a list service that reads a window.
// `total` counts every match, so the page a reader is on says how many there are.
export async function paginate<T>(
  query: { page?: number; pageSize?: number },
  read: (window: { limit: number; offset: number }) => Promise<{ items: T[]; total: number }>,
): Promise<{ items: T[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const { items, total } = await read({ limit: pageSize, offset: (page - 1) * pageSize });
  return { items, total, page, pageSize };
}
