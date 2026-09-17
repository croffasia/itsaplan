import { Elysia, t } from 'elysia';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { noContent } from '../shared/http';
import { HttpError, pgErrorCode } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { mcpTool } from '../mcp/generate';
import { listDirectory, readMetrics, searchDirectory } from './inspect';
import {
  clearHostKey,
  createServer,
  deleteServer,
  getServer,
  getServerCredential,
  getServerOverview,
  getServerProjectId,
  listLinkableCustomers,
  listServerSessions,
  listServers,
  updateServer,
} from './store';

const projectParams = t.Object({ projectKey: t.String() });
const serverParams = t.Object({ serverId: t.Numeric() });

const AuthTypeSchema = t.Union([t.Literal('password'), t.Literal('key')]);
const TagsSchema = t.Array(t.String({ minLength: 1, maxLength: 40 }), { maxItems: 12 });

const ServerResponse = t.Object({
  id: t.Number(),
  label: t.String(),
  host: t.String(),
  port: t.Number(),
  username: t.String(),
  authType: AuthTypeSchema,
  customerId: t.Nullable(t.Number()),
  customerName: t.Nullable(t.String()),
  tags: t.Array(t.String()),
  notes: t.String(),
  active: t.Boolean(),
  hostKeyFingerprint: t.Nullable(t.String()),
  lastConnectedAt: t.Nullable(t.String()),
  addedByName: t.Nullable(t.String()),
  createdAt: t.String(),
});

const SessionResponse = t.Object({
  id: t.Number(),
  serverId: t.Number(),
  serverLabel: t.String(),
  userName: t.Nullable(t.String()),
  status: t.String(),
  errorCode: t.Nullable(t.String()),
  bytesIn: t.Number(),
  bytesOut: t.Number(),
  startedAt: t.String(),
  endedAt: t.Nullable(t.String()),
});

const OverviewResponse = t.Object({
  total: t.Number(),
  active: t.Number(),
  customers: t.Number(),
  sessionsToday: t.Number(),
  unpinned: t.Number(),
});

const FileResponse = t.Object({
  path: t.String(),
  entries: t.Array(
    t.Object({
      name: t.String(),
      kind: t.Union([t.Literal('dir'), t.Literal('file'), t.Literal('link')]),
      size: t.Number(),
      modifiedAt: t.Nullable(t.String()),
    }),
  ),
});

const SearchResponse = t.Object({
  path: t.String(),
  truncated: t.Boolean(),
  entries: t.Array(
    t.Object({
      name: t.String(),
      kind: t.Union([t.Literal('dir'), t.Literal('file'), t.Literal('link')]),
      size: t.Number(),
      modifiedAt: t.Nullable(t.String()),
      directory: t.String(),
    }),
  ),
});

const MetricsResponse = t.Object({
  hostname: t.String(),
  os: t.String(),
  kernel: t.String(),
  uptimeSeconds: t.Number(),
  cpuCount: t.Number(),
  cpuPercent: t.Number(),
  loadAverage: t.Array(t.Number()),
  memoryTotalKb: t.Number(),
  memoryUsedKb: t.Number(),
  diskTotalKb: t.Number(),
  diskUsedKb: t.Number(),
});

// A hostname or an IP. Kept strict so a stored target cannot carry a shell
// argument or a URL.
const HOST_PATTERN = /^[a-zA-Z0-9._-]+$/;

export const serverRoutes = new Elysia({ name: 'servers', detail: { tags: ['Servers'] } })
  .use(authContext)
  .use(guards)
  .macro({
    server: entityGuard('servers', 'Server not found', (p) =>
      getServerProjectId(Number(p.serverId)),
    ),
  })

  .get('/projects/:projectKey/servers/overview', ({ project }) => getServerOverview(project.id), {
    params: projectParams,
    permission: ['servers', 'read'],
    response: { 200: OverviewResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
    detail: { summary: 'Server overview' },
  })

  .get(
    '/projects/:projectKey/servers/customers',
    ({ project }) => listLinkableCustomers(project.id),
    {
      params: projectParams,
      permission: ['servers', 'read'],
      response: {
        200: t.Array(t.Object({ id: t.Number(), name: t.String() })),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Customers a server can be attached to' },
    },
  )

  .get('/projects/:projectKey/servers', ({ project }) => listServers(project.id), {
    params: projectParams,
    permission: ['servers', 'read'],
    response: {
      200: t.Array(ServerResponse),
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: { summary: 'List servers', ...mcpTool('list_servers') },
  })

  .get(
    '/projects/:projectKey/servers/sessions',
    ({ project, query }) => listServerSessions(project.id, query.limit ?? 50),
    {
      params: projectParams,
      query: t.Object({ limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })) }),
      permission: ['servers', 'read'],
      response: {
        200: t.Array(SessionResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Terminal session history' },
    },
  )

  .post(
    '/projects/:projectKey/servers',
    async ({ project, body, user, set }) => {
      const host = body.host.trim();
      if (!HOST_PATTERN.test(host)) throw new HttpError(400, 'That is not a valid host');
      if (body.secret.trim().length === 0) throw new HttpError(400, 'A credential is required');
      try {
        const row = await createServer({
          projectId: project.id,
          addedByUserId: user?.id ?? null,
          customerId: body.customerId ?? null,
          label: body.label.trim(),
          host,
          port: body.port ?? 22,
          username: body.username.trim(),
          authType: body.authType,
          secret: body.secret,
          passphrase: body.passphrase ?? null,
          tags: body.tags ?? [],
          notes: body.notes?.trim() ?? '',
        });
        set.status = 201;
        return row;
      } catch (error) {
        if (pgErrorCode(error) === '23505') {
          throw new HttpError(409, 'That user on that host is already registered');
        }
        throw error;
      }
    },
    {
      params: projectParams,
      body: t.Object({
        label: t.String({ minLength: 1, maxLength: 120 }),
        host: t.String({ minLength: 1, maxLength: 255 }),
        port: t.Optional(t.Number({ minimum: 1, maximum: 65535 })),
        username: t.String({ minLength: 1, maxLength: 64 }),
        authType: AuthTypeSchema,
        // The password or the private key. Stored encrypted and never returned.
        secret: t.String({ minLength: 1, maxLength: 20_000 }),
        passphrase: t.Optional(t.String({ maxLength: 500 })),
        customerId: t.Optional(t.Number()),
        tags: t.Optional(TagsSchema),
        notes: t.Optional(t.String({ maxLength: 2_000 })),
      }),
      permission: ['servers', 'create'],
      response: {
        201: ServerResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: { summary: 'Register a server' },
    },
  )

  .patch(
    '/servers/:serverId',
    async ({ params, body }) => {
      if (body.host !== undefined && !HOST_PATTERN.test(body.host.trim())) {
        throw new HttpError(400, 'That is not a valid host');
      }
      const row = await updateServer(params.serverId, {
        ...(body.label != null ? { label: body.label.trim() } : {}),
        ...(body.host != null ? { host: body.host.trim() } : {}),
        ...(body.port != null ? { port: body.port } : {}),
        ...(body.username != null ? { username: body.username.trim() } : {}),
        ...(body.authType != null ? { authType: body.authType } : {}),
        ...(body.secret ? { secret: body.secret } : {}),
        ...(body.passphrase !== undefined ? { passphrase: body.passphrase } : {}),
        ...(body.customerId !== undefined ? { customerId: body.customerId } : {}),
        ...(body.tags != null ? { tags: body.tags } : {}),
        ...(body.notes != null ? { notes: body.notes.trim() } : {}),
        ...(body.active != null ? { active: body.active } : {}),
      });
      if (!row) throw new HttpError(404, 'Server not found');
      return row;
    },
    {
      params: serverParams,
      body: t.Object({
        label: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
        host: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        port: t.Optional(t.Number({ minimum: 1, maximum: 65535 })),
        username: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
        authType: t.Optional(AuthTypeSchema),
        secret: t.Optional(t.String({ minLength: 1, maxLength: 20_000 })),
        passphrase: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        customerId: t.Optional(t.Nullable(t.Number())),
        tags: t.Optional(TagsSchema),
        notes: t.Optional(t.String({ maxLength: 2_000 })),
        active: t.Optional(t.Boolean()),
      }),
      server: 'edit',
      response: {
        200: ServerResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Update a server' },
    },
  )

  // Clears the pinned host key so the next connection pins the current one. Used
  // after a deliberate rebuild or key rotation, when the change is expected.
  .post(
    '/servers/:serverId/repin',
    async ({ params }) => {
      await clearHostKey(params.serverId);
      const row = await getServer(params.serverId);
      if (!row) throw new HttpError(404, 'Server not found');
      return row;
    },
    {
      params: serverParams,
      server: 'edit',
      response: {
        200: ServerResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Forget the pinned host key' },
    },
  )

  // Reading a directory is as revealing as a shell, so it needs the same access
  // as the terminal rather than plain read.
  .get(
    '/servers/:serverId/files',
    async ({ params, query }) => {
      const credential = await getServerCredential(params.serverId);
      if (!credential) throw new HttpError(404, 'Server not found');
      try {
        return await listDirectory(credential, query.path ?? '/');
      } catch {
        throw new HttpError(502, 'Could not read that directory on the server');
      }
    },
    {
      params: serverParams,
      query: t.Object({ path: t.Optional(t.String({ maxLength: 4096 })) }),
      server: 'edit',
      response: {
        200: FileResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'List a directory on a server' },
    },
  )

  .get(
    '/servers/:serverId/files/search',
    async ({ params, query }) => {
      const credential = await getServerCredential(params.serverId);
      if (!credential) throw new HttpError(404, 'Server not found');
      try {
        return await searchDirectory(credential, query.path ?? '/', query.q);
      } catch {
        throw new HttpError(502, 'Could not search that directory on the server');
      }
    },
    {
      params: serverParams,
      query: t.Object({
        path: t.Optional(t.String({ maxLength: 4096 })),
        q: t.String({ minLength: 2, maxLength: 200 }),
      }),
      server: 'edit',
      response: {
        200: SearchResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Search for a file under a directory' },
    },
  )

  .get(
    '/servers/:serverId/metrics',
    async ({ params }) => {
      const credential = await getServerCredential(params.serverId);
      if (!credential) throw new HttpError(404, 'Server not found');
      try {
        return await readMetrics(credential);
      } catch {
        throw new HttpError(502, 'Could not read the counters on this server');
      }
    },
    {
      params: serverParams,
      server: 'edit',
      response: {
        200: MetricsResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Read cpu, memory and disk counters' },
    },
  )

  .delete(
    '/servers/:serverId',
    async ({ params }) => {
      await deleteServer(params.serverId);
      return noContent();
    },
    {
      params: serverParams,
      server: 'delete',
      response: { 204: t.Void(), 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Remove a server' },
    },
  );
