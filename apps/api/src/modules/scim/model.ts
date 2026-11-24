import { t } from 'elysia';

// Request and response schemas for the SCIM endpoints.
//
// The request *bodies* are read as `t.Any()` in index.ts and validated in
// resource.ts instead: SCIM defines its own schemas, clients send attributes this
// app ignores, and a rejection has to come back as a SCIM error document rather than
// the planner's validation error. The responses are declared here, so the OpenAPI
// spec and the Eden client both describe what the endpoints actually return.

// SCIM ids are opaque strings: a user id is better-auth's, a group id a uuid.
export const resourceParams = t.Object({ id: t.String() });

export const listQuery = t.Object({
  // `<attribute> eq "<value>"`. What is filterable is listed per resource in
  // service.ts and advertised in ServiceProviderConfig.
  filter: t.Optional(t.String()),
  // SCIM paging is 1-based, unlike the offset/limit used elsewhere in this API.
  startIndex: t.Optional(t.Numeric({ minimum: 1 })),
  count: t.Optional(t.Numeric({ minimum: 0, maximum: 200 })),
});

const meta = t.Object({
  resourceType: t.String(),
  created: t.String(),
  lastModified: t.String(),
  location: t.String(),
});

export const ScimUserResponse = t.Object({
  schemas: t.Array(t.String()),
  id: t.String(),
  externalId: t.Optional(t.String()),
  userName: t.String(),
  name: t.Object({
    formatted: t.String(),
    givenName: t.String(),
    familyName: t.String(),
  }),
  displayName: t.String(),
  emails: t.Array(t.Object({ value: t.String(), primary: t.Boolean(), type: t.String() })),
  active: t.Boolean(),
  meta,
});

export const ScimGroupResponse = t.Object({
  schemas: t.Array(t.String()),
  id: t.String(),
  externalId: t.Optional(t.String()),
  displayName: t.String(),
  members: t.Array(t.Object({ value: t.String(), display: t.String(), $ref: t.String() })),
  meta,
});

function listOf<T extends ReturnType<typeof t.Object>>(resource: T) {
  return t.Object({
    schemas: t.Array(t.String()),
    totalResults: t.Integer(),
    startIndex: t.Integer(),
    itemsPerPage: t.Integer(),
    Resources: t.Array(resource),
  });
}

export const ScimUserListResponse = listOf(ScimUserResponse);
export const ScimGroupListResponse = listOf(ScimGroupResponse);

// The discovery documents are static constants describing the SCIM standard itself,
// so they are declared as they are rather than mirrored attribute by attribute.
export const ScimDocumentResponse = t.Any();
export const ScimDocumentListResponse = t.Object({
  schemas: t.Array(t.String()),
  totalResults: t.Integer(),
  startIndex: t.Integer(),
  itemsPerPage: t.Integer(),
  Resources: t.Array(t.Any()),
});

// RFC 7644 §3.12. `status` is a string here, unlike everywhere else in this API.
const ScimErrorResponse = t.Object({
  schemas: t.Array(t.String()),
  status: t.String(),
  scimType: t.Optional(t.String()),
  detail: t.String(),
});

// The SCIM error document, for each status a route can fail with. Same shape as
// shared/responses.ts `errors`, including the cast that keeps the status codes as
// literal keys — without it Eden Treaty cannot tell a failure body from a success
// one. The planner's own error map is the wrong body here.
export const scimErrors = <const C extends readonly number[]>(...codes: C) =>
  Object.fromEntries(codes.map((code) => [code, ScimErrorResponse])) as {
    [K in C[number]]: typeof ScimErrorResponse;
  };

// ── Settings ──────────────────────────────────────────────────────────────────
// The routes god mode and a workspace's settings set a provider up with.

export const ScimSettingsResponse = t.Object({
  enabled: t.Boolean(),
  hasToken: t.Boolean(),
  tokenPrefix: t.String(),
  // Where to point the identity provider. Derived from the API origin, so the UI
  // shows it rather than asking the owner to assemble it.
  baseUrl: t.String(),
});

export const ScimSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
});

// The generated token, returned once. It is not stored anywhere it can be read
// back, so a lost token is replaced rather than recovered.
export const ScimTokenResponse = t.Object({
  token: t.String(),
});

const scimGroupMapping = t.Object({
  projectId: t.Integer(),
  role: t.UnionEnum(['owner', 'member']),
  // Which team_role a member joins on. Null for an owner (owners bypass the
  // permission matrix) or to fall back to the default role.
  roleId: t.Nullable(t.Integer()),
});

export const ProvisionedGroupResponse = t.Object({
  id: t.String(),
  displayName: t.String(),
  externalId: t.Nullable(t.String()),
  memberCount: t.Integer(),
  mappings: t.Array(
    t.Intersect([scimGroupMapping, t.Object({ projectKey: t.String(), projectName: t.String() })]),
  ),
});

export const ScimGroupMappingsBody = t.Object({
  mappings: t.Array(scimGroupMapping, { maxItems: 100 }),
});

export const MappableProjectListResponse = t.Array(
  t.Object({
    id: t.Number(),
    key: t.String(),
    name: t.String(),
    roles: t.Array(t.Object({ id: t.Number(), name: t.String() })),
  }),
);
