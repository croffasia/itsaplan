import { Elysia, t } from 'elysia';
import { isScimEnabled, verifyScimToken } from '@repo/auth';
import { HttpError } from '#shared/lib';
import { noContent } from '#shared/http';
import {
  SCIM_CONTENT_TYPE,
  SCIM_PREFIX,
  ScimError,
  asBoolean,
  asString,
  groupDisplayNames,
  joinName,
  memberFilterIds,
  memberIds,
  parseFilter,
  parsePatch,
  readEmail,
  readAccountEmail,
  scimErrorBody,
  splitName,
  toListResponse,
  toScimGroup,
  toScimUser,
} from './resource';
import { RESOURCE_TYPES, SCHEMAS, SERVICE_PROVIDER_CONFIG } from './discovery';
import {
  ScimDocumentListResponse,
  ScimDocumentResponse,
  ScimGroupListResponse,
  ScimGroupResponse,
  ScimUserListResponse,
  ScimUserResponse,
  listQuery,
  resourceParams,
  scimErrors,
} from './model';
import {
  GROUP_FILTER_ATTRIBUTES,
  USER_FILTER_ATTRIBUTES,
  createScimGroup,
  createScimUser,
  deleteScimGroup,
  deleteScimUser,
  getScimGroup,
  getScimUser,
  listScimGroups,
  listScimUsers,
  syncEmbeddedGroups,
  updateScimGroup,
  updateScimUser,
} from './service';

// SCIM 2.0 provisioning (RFC 7643 / 7644). An identity provider pushes users and
// groups here with the instance's SCIM bearer token.

function extractToken(authorization: string | undefined): string | null {
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

// The bodies are read as `t.Any()`: SCIM defines its own schemas and clients send
// attributes this app ignores, so rejecting an unknown field would fail a
// provisioning run over something harmless. The shapes are checked in resource.ts,
// which raises SCIM errors rather than the planner's validation error.
const anyBody = { body: t.Any() };

// A create or replace body, cast and checked. Guards the four spots that read
// `doc.<attribute>` straight off the request body: without this, a request that
// reached the handler with no body (a client-parse mismatch, or a body Elysia
// left unparsed) would throw inside the handler instead of answering a SCIM 400.
function asDoc(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ScimError(400, 'A JSON object body is required', 'invalidSyntax');
  }
  return body as Record<string, unknown>;
}

function requestedPage(query: { startIndex?: number; count?: number }) {
  return {
    startIndex: Math.max(1, query.startIndex ?? 1),
    count: Math.min(Math.max(query.count ?? 100, 0), 200),
  };
}

const scimHandlers = new Elysia({ name: 'scim-handlers', prefix: SCIM_PREFIX })
  // RFC 7644 §3.1 allows a SCIM client to send `application/scim+json`, and real
  // identity providers (Okta, Entra, Authentik) do. Elysia's default body parser
  // matches `Content-Type` exactly against `application/json`, so a request sent
  // with the SCIM type would otherwise leave `body` undefined instead of parsed.
  // Falling through (returning undefined) for anything else keeps plain
  // `application/json` on Elysia's own parser.
  .onParse(({ request, contentType }) => {
    if (contentType?.includes('json')) return request.json();
  })
  .onBeforeHandle(async ({ headers, set }) => {
    set.headers['content-type'] = SCIM_CONTENT_TYPE;
    const token = extractToken(headers.authorization);
    // One answer for "off", "no token" and "wrong token": whether provisioning is
    // configured is not something an unauthenticated caller should learn.
    if (!token || !(await isScimEnabled()) || !(await verifyScimToken(token))) {
      throw new ScimError(401, 'Invalid or missing SCIM bearer token');
    }
  })

  // ── Discovery ───────────────────────────────────────────────────────────────

  .get('/ServiceProviderConfig', () => SERVICE_PROVIDER_CONFIG, {
    response: { 200: ScimDocumentResponse, ...scimErrors(401) },
    detail: { summary: 'Get the SCIM service provider configuration' },
  })

  .get('/ResourceTypes', () => toListResponse(RESOURCE_TYPES, RESOURCE_TYPES.length, 1), {
    response: { 200: ScimDocumentListResponse, ...scimErrors(401) },
    detail: { summary: 'List the SCIM resource types' },
  })

  .get(
    '/ResourceTypes/:id',
    ({ params }) => {
      const found = RESOURCE_TYPES.find((r) => r.id === params.id);
      if (!found) throw new ScimError(404, `Resource type '${params.id}' not found`);
      return found;
    },
    {
      params: resourceParams,
      response: { 200: ScimDocumentResponse, ...scimErrors(401, 404) },
      detail: { summary: 'Get one SCIM resource type' },
    },
  )

  .get('/Schemas', () => toListResponse(SCHEMAS, SCHEMAS.length, 1), {
    response: { 200: ScimDocumentListResponse, ...scimErrors(401) },
    detail: { summary: 'List the SCIM schemas' },
  })

  .get(
    '/Schemas/:id',
    ({ params }) => {
      const found = SCHEMAS.find((s) => s.id === params.id);
      if (!found) throw new ScimError(404, `Schema '${params.id}' not found`);
      return found;
    },
    {
      params: resourceParams,
      response: { 200: ScimDocumentResponse, ...scimErrors(401, 404) },
      detail: { summary: 'Get one SCIM schema' },
    },
  )

  // ── Users ───────────────────────────────────────────────────────────────────

  .get(
    '/Users',
    async ({ query }) => {
      const page = requestedPage(query);
      const { records, total } = await listScimUsers({
        filter: parseFilter(query.filter, USER_FILTER_ATTRIBUTES),
        ...page,
      });
      return toListResponse(records.map(toScimUser), total, page.startIndex);
    },
    {
      query: listQuery,
      response: { 200: ScimUserListResponse, ...scimErrors(400, 401) },
      detail: { summary: 'List provisioned users' },
    },
  )

  .post(
    '/Users',
    async ({ body, set }) => {
      const doc = asDoc(body);
      const email = readAccountEmail(doc);
      const record = await createScimUser({
        email,
        name: joinName(doc.name as never, (doc.displayName as string) || email),
        active: doc.active === undefined ? true : asBoolean(doc.active),
        externalId: typeof doc.externalId === 'string' ? doc.externalId : null,
      });
      await syncEmbeddedGroups(record.id, groupDisplayNames(doc.groups));
      set.status = 201;
      return toScimUser(record);
    },
    {
      ...anyBody,
      response: { 201: ScimUserResponse, ...scimErrors(400, 401, 409) },
      detail: { summary: 'Provision a user' },
    },
  )

  .get('/Users/:id', async ({ params }) => toScimUser(await requireUser(params.id)), {
    params: resourceParams,
    response: { 200: ScimUserResponse, ...scimErrors(401, 404) },
    detail: { summary: 'Get one provisioned user' },
  })

  .put(
    '/Users/:id',
    async ({ params, body }) => {
      const current = await requireUser(params.id);
      const doc = asDoc(body);
      const email = readAccountEmail(doc);
      const updated = await updateScimUser(params.id, {
        email,
        name: joinName(doc.name as never, (doc.displayName as string) || current.name),
        active: doc.active === undefined ? true : asBoolean(doc.active),
        externalId: typeof doc.externalId === 'string' ? doc.externalId : null,
      });
      await syncEmbeddedGroups(params.id, groupDisplayNames(doc.groups));
      return toScimUser(requireUpdated(updated, 'User', params.id));
    },
    {
      params: resourceParams,
      ...anyBody,
      response: { 200: ScimUserResponse, ...scimErrors(400, 401, 404, 409) },
      detail: { summary: 'Replace a provisioned user' },
    },
  )

  .patch(
    '/Users/:id',
    async ({ params, body }) => {
      const current = await requireUser(params.id);
      const patch: { email?: string; name?: string; active?: boolean; externalId?: string | null } =
        {};
      for (const op of parsePatch(body)) {
        const path = op.path!.toLowerCase();
        if (op.op === 'remove') {
          // The only removable attribute is the deprovisioning flag; everything
          // else is required for the account to be usable.
          if (path !== 'active') {
            throw new ScimError(400, `Attribute '${op.path}' cannot be removed`, 'invalidPath');
          }
          patch.active = false;
          continue;
        }
        if (path === 'active') patch.active = asBoolean(op.value);
        else if (path === 'username') patch.email = asString(op.value, 'userName');
        else if (path === 'externalid') patch.externalId = asString(op.value, 'externalId');
        else if (path === 'displayname' || path === 'name.formatted') {
          patch.name = asString(op.value, 'name');
        } else if (path === 'name') {
          patch.name = joinName(op.value as never, current.name);
        } else if (path === 'name.givenname' || path === 'name.familyname') {
          const parts = splitName(patch.name ?? current.name);
          const key = path === 'name.givenname' ? 'givenName' : 'familyName';
          patch.name = joinName({ ...parts, [key]: asString(op.value, 'name') }, current.name);
        } else if (path.startsWith('emails')) {
          patch.email = readEmail(op.value);
        } else {
          throw new ScimError(400, `Attribute '${op.path}' is not writable`, 'invalidPath');
        }
      }
      const updated = await updateScimUser(params.id, patch);
      return toScimUser(requireUpdated(updated, 'User', params.id));
    },
    {
      params: resourceParams,
      ...anyBody,
      response: { 200: ScimUserResponse, ...scimErrors(400, 401, 404, 409) },
      detail: { summary: 'Update a provisioned user' },
    },
  )

  .delete(
    '/Users/:id',
    async ({ params }) => {
      await deleteScimUser(params.id);
      return noContent();
    },
    {
      params: resourceParams,
      response: { 204: t.Void(), ...scimErrors(401, 404, 409) },
      detail: { summary: 'Delete a provisioned user' },
    },
  )

  // ── Groups ──────────────────────────────────────────────────────────────────

  .get(
    '/Groups',
    async ({ query }) => {
      const page = requestedPage(query);
      const { records, total } = await listScimGroups({
        filter: parseFilter(query.filter, GROUP_FILTER_ATTRIBUTES),
        ...page,
      });
      return toListResponse(records.map(toScimGroup), total, page.startIndex);
    },
    {
      query: listQuery,
      response: { 200: ScimGroupListResponse, ...scimErrors(400, 401) },
      detail: { summary: 'List provisioned groups' },
    },
  )

  .post(
    '/Groups',
    async ({ body, set }) => {
      const doc = asDoc(body);
      const record = await createScimGroup({
        displayName: asString(doc.displayName, 'displayName'),
        externalId: typeof doc.externalId === 'string' ? doc.externalId : null,
        members: doc.members === undefined ? [] : memberIds(doc.members),
      });
      set.status = 201;
      return toScimGroup(record);
    },
    {
      ...anyBody,
      response: { 201: ScimGroupResponse, ...scimErrors(400, 401, 409) },
      detail: { summary: 'Provision a group' },
    },
  )

  .get('/Groups/:id', async ({ params }) => toScimGroup(await requireGroup(params.id)), {
    params: resourceParams,
    response: { 200: ScimGroupResponse, ...scimErrors(401, 404) },
    detail: { summary: 'Get one provisioned group' },
  })

  .put(
    '/Groups/:id',
    async ({ params, body }) => {
      await requireGroup(params.id);
      const doc = asDoc(body);
      const updated = await updateScimGroup(params.id, {
        displayName: asString(doc.displayName, 'displayName'),
        externalId: typeof doc.externalId === 'string' ? doc.externalId : null,
        members: doc.members === undefined ? [] : memberIds(doc.members),
      });
      return toScimGroup(requireUpdated(updated, 'Group', params.id));
    },
    {
      params: resourceParams,
      ...anyBody,
      response: { 200: ScimGroupResponse, ...scimErrors(400, 401, 404, 409) },
      detail: { summary: 'Replace a provisioned group' },
    },
  )

  .patch(
    '/Groups/:id',
    async ({ params, body }) => {
      const current = await requireGroup(params.id);
      const patch: { displayName?: string; externalId?: string | null; members?: string[] } = {};
      let members = new Set(current.members.map((member) => member.userId));
      let membersChanged = false;
      for (const op of parsePatch(body)) {
        const path = op.path!.toLowerCase();
        if (path.startsWith('members')) {
          // A remove sent as a path filter (RFC 7644 §3.5.2.2, e.g. Okta) carries
          // the id in the path itself, not in `value`.
          const ids =
            memberFilterIds(op.path!) ?? (op.value === undefined ? [] : memberIds(op.value));
          if (op.op === 'remove') ids.forEach((id) => members.delete(id));
          else if (op.op === 'add') ids.forEach((id) => members.add(id));
          else members = new Set(ids);
          membersChanged = true;
          continue;
        }
        if (op.op === 'remove') {
          throw new ScimError(400, `Attribute '${op.path}' cannot be removed`, 'invalidPath');
        }
        if (path === 'displayname') patch.displayName = asString(op.value, 'displayName');
        else if (path === 'externalid') patch.externalId = asString(op.value, 'externalId');
        else throw new ScimError(400, `Attribute '${op.path}' is not writable`, 'invalidPath');
      }
      if (membersChanged) patch.members = [...members];
      const updated = await updateScimGroup(params.id, patch);
      return toScimGroup(requireUpdated(updated, 'Group', params.id));
    },
    {
      params: resourceParams,
      ...anyBody,
      response: { 200: ScimGroupResponse, ...scimErrors(400, 401, 404, 409) },
      detail: { summary: 'Update a provisioned group' },
    },
  )

  .delete(
    '/Groups/:id',
    async ({ params }) => {
      if (!(await deleteScimGroup(params.id))) {
        throw new ScimError(404, `Group '${params.id}' not found`);
      }
      return noContent();
    },
    {
      params: resourceParams,
      response: { 204: t.Void(), ...scimErrors(401, 404) },
      detail: { summary: 'Delete a provisioned group' },
    },
  );

// SCIM failures carry their own document, so this replaces the planner's `{ error }`
// handler for these routes. Two things decide its shape:
//
//   - It wraps the routes from the outside rather than sitting on the same instance.
//     An onError beside the routes widens the inferred response type of every one of
//     them with the body it returns, which reaches the Eden client as a success shape.
//   - Elysia propagates it to the root app, and from there over every route, so it
//     answers only for its own paths and hands everything else back for the planner's
//     handler to answer.
export const scimRoutes = new Elysia({ name: 'scim' })
  .onError({ as: 'global' }, ({ error, path, set }) => {
    if (!path.startsWith(SCIM_PREFIX)) return;
    set.headers['content-type'] = SCIM_CONTENT_TYPE;
    if (error instanceof ScimError) {
      set.status = error.status;
      return scimErrorBody(error.status, error.message, error.scimType);
    }
    if (error instanceof HttpError) {
      set.status = error.status;
      return scimErrorBody(error.status, error.message);
    }
    console.error('[scim]', error);
    set.status = 500;
    return scimErrorBody(500, 'Internal error');
  })
  .use(scimHandlers);

// The update returns null when the row is gone, which the read at the start of the
// handler cannot rule out. Answering 404 keeps a provisioning client on a path it
// understands instead of a 500.
function requireUpdated<T>(record: T | null, resource: string, id: string): T {
  if (!record) throw new ScimError(404, `${resource} '${id}' not found`);
  return record;
}

async function requireUser(id: string) {
  const record = await getScimUser(id);
  if (!record) throw new ScimError(404, `User '${id}' not found`);
  return record;
}

async function requireGroup(id: string) {
  const record = await getScimGroup(id);
  if (!record) throw new ScimError(404, `Group '${id}' not found`);
  return record;
}
