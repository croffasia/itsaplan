import { t } from 'elysia';

// Every planner failure is normalized by the planner plugin's onError to this
// body: a JSON { error } with the failure's status (HttpError status, 400 for a
// validation rejection, 404 for NOT_FOUND, 409 for a unique_violation, 500
// otherwise). Referenced by each route's `response` map so the OpenAPI docs
// describe the error bodies alongside the success shape.
// `code` is present only on the failures that name themselves (see HttpError).
export const ErrorResponse = t.Object({ error: t.String(), code: t.Optional(t.String()) });

// Maps the statuses a route can fail with to that one body. A route lists only
// the codes it produces; spread the result into `response` next to the success
// shape.
export const errors = <const C extends readonly number[]>(...codes: C) =>
  Object.fromEntries(codes.map((code) => [code, ErrorResponse])) as {
    [K in C[number]]: typeof ErrorResponse;
  };

// The failures of a project-guarded route: no session, the permission check, an
// unknown project or entity.
export const accessErrors = errors(401, 403, 404);

// The same plus a schema rejection, for a route that validates a body or params.
export const commonErrors = errors(400, 401, 403, 404);
