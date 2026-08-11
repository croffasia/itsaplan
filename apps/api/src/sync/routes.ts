import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { requireUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { NO_REV, readRevs, scopeKind, type ScopeRead } from './store';

const MAX_SCOPES = 20;

// Live refresh: the change markers of everything one client is watching, in a
// single request. A screen registers the scopes it depends on, the client polls
// them together, and refetches its heavy queries only for the scopes that moved.
// The markers themselves are written by database triggers (migration 0070).
export const syncRoutes = new Elysia({ name: 'sync', detail: { tags: ['Sync'] } })
  .use(authContext)

  .get(
    '/sync/rev',
    async ({ user, query }) => {
      const userId = requireUser(user).id;
      const requested = query.scopes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (requested.length > MAX_SCOPES) {
        throw new HttpError(400, `At most ${MAX_SCOPES} scopes per request`);
      }

      // Keyed by what the client sent, so it can look the answer up without
      // knowing how a scope is stored.
      const reads = new Map<string, ScopeRead>();
      for (const scope of requested) {
        const [kind, rawId] = scope.split(':');
        // Own properties only: an inherited name like '__proto__' is not a kind.
        const spec = kind && Object.hasOwn(scopeKind, kind) ? scopeKind[kind] : undefined;
        const id = Number(rawId);
        if (!spec || !Number.isInteger(id) || id <= 0) {
          throw new HttpError(400, `Unknown scope '${scope}'`);
        }
        reads.set(scope, { key: spec.key(id, userId), resource: spec.resource });
      }

      const found = await readRevs([...reads.values()], userId);
      return {
        revs: Object.fromEntries(
          [...reads].map(([scope, read]) => [scope, found[read.key] ?? NO_REV]),
        ),
      };
    },
    {
      query: t.Object({
        scopes: t.String({
          description:
            "Comma-separated scopes to read, each '<kind>:<id>' — board, issue, initiative, or inbox (by project id).",
        }),
      }),
      response: {
        200: t.Object({ revs: t.Record(t.String(), t.String()) }),
        400: ErrorResponse,
        401: ErrorResponse,
      },
      detail: {
        summary: 'Get change markers',
        description:
          'Read the change marker of every scope a client is watching. A marker moves whenever anything that scope covers is written; its value is opaque — compare it with the previous one and refetch when it differs. An unknown or inaccessible scope reads as "0".',
      },
    },
  );
