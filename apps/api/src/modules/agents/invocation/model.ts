import { t } from 'elysia';

export { agentParams } from '../model';

export const InvocationSecretResponse = t.Object({
  secret: t.Nullable(
    t.String({ description: 'Null while the agent has never had an invocation URL.' }),
  ),
});

export const RotatedInvocationSecretResponse = t.Object({ secret: t.String() });

// InvocationOutcome from the service.
export const InvocationTestResponse = t.Object({
  ok: t.Boolean({ description: 'The endpoint answered 2xx.' }),
  timedOut: t.Boolean(),
  status: t.Nullable(t.Number({ description: 'HTTP status, null when none arrived.' })),
  error: t.Nullable(t.String()),
  responseBody: t.Nullable(t.String({ description: 'The start of what the endpoint answered.' })),
  durationMs: t.Number(),
});
