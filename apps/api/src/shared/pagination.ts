import { t, type TSchema } from 'elysia';

// The page/pageSize pair a paged list route takes, and the envelope it answers
// with. Spread the fields into a route's own query schema:
//
//   export const listQuery = t.Object({ search: t.Optional(t.String()), ...pageQueryFields });
//   export const listResponse = pageResponse(ThingResponse);
export const pageQueryFields = {
  page: t.Optional(t.Numeric({ minimum: 1, description: '1-based page. Default 1.' })),
  pageSize: t.Optional(
    t.Numeric({ minimum: 1, maximum: 100, description: 'Items per page (1-100). Default 25.' }),
  ),
};

export const pageResponse = <T extends TSchema>(item: T) =>
  t.Object({
    items: t.Array(item),
    total: t.Number(),
    page: t.Number(),
    pageSize: t.Number(),
  });
