import { t } from 'elysia';

export const ConnectedApp = t.Object({
  clientId: t.String(),
  name: t.String(),
  icon: t.Union([t.String(), t.Null()]),
  scopes: t.Array(t.String()),
  connectedAt: t.String({ format: 'date-time' }),
  // The last refresh token issued to it: every refresh rotates it, so this is roughly
  // the last time the application renewed its access.
  lastUsedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
});

export const ConnectedAppParams = t.Object({ clientId: t.String({ minLength: 1 }) });
