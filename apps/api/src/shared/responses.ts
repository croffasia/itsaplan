import { t } from 'elysia';

// Every planner failure is normalized by the planner plugin's onError to this
// body: a JSON { error } with the failure's status (HttpError status, 400 for a
// validation rejection, 404 for NOT_FOUND, 409 for a unique_violation, 500
// otherwise). Referenced by each route's `response` map so the OpenAPI docs
// describe the error bodies alongside the success shape.
export const ErrorResponse = t.Object({ error: t.String() });
