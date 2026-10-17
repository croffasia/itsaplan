import { t } from 'elysia';

// Every field of the stored user is declared: the response drops any field the schema
// leaves out.
export const CurrentUser = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  emailVerified: t.Boolean(),
  image: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
  // An agent's handle lives on its agent row; this carries it, as the member list does.
  username: t.Nullable(t.String()),
  displayUsername: t.Nullable(t.String()),
  role: t.Nullable(t.String()),
  active: t.Nullable(t.Boolean()),
  // The IANA zone the person reads dates in, so "today" or "this week" can be told.
  timezone: t.String(),
  isAgent: t.Boolean(),
});

export const Me = t.Union([
  t.Object({ authenticated: t.Literal(false) }),
  t.Object({ authenticated: t.Literal(true), user: CurrentUser }),
]);
