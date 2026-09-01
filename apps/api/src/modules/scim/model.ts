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
