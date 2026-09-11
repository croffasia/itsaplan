import { t } from 'elysia';

export const importJobParams = t.Object({ id: t.Numeric() });

const stateCategory = t.UnionEnum(['backlog', 'unstarted', 'started', 'completed', 'canceled']);

// The fields Plane needs to reach the source project, plus the mapping choices made
// at creation time.
export const createImportJobBody = t.Object({
  baseUrl: t.String({ minLength: 1, description: 'Origin of the source Plane instance.' }),
  workspaceSlug: t.String({ minLength: 1 }),
  apiToken: t.String({ minLength: 1, description: 'Plane workspace or personal API key.' }),
  planeProjectId: t.String({ minLength: 1, description: 'The Plane project id to import from.' }),
  planeProjectKey: t.String({
    minLength: 1,
    description:
      'The Plane project\'s own short identifier (e.g. "ROOMS"), used to recognize and ' +
      'rewrite cross-references like "ROOMS-524" in imported text.',
  }),
  unmatchedUserPolicy: t.Optional(
    t.UnionEnum(['unassigned', 'skip'], {
      description:
        'How to handle an assignee or comment author with no matching project member by email. ' +
        "'unassigned' (default) leaves the field empty; 'skip' drops the assignment or comment.",
    }),
  ),
  stateOverrides: t.Optional(
    t.Record(t.String(), stateCategory, {
      description: 'Plane state id -> itsaplan state category, overriding the automatic mapping.',
    }),
  ),
});

export const testConnectionBody = t.Object({
  baseUrl: t.String({ minLength: 1 }),
  workspaceSlug: t.String({ minLength: 1 }),
  apiToken: t.String({ minLength: 1 }),
});

export const TestConnectionResponse = t.Object({
  projects: t.Array(t.Object({ id: t.String(), name: t.String(), identifier: t.String() })),
});

// Mirrors import_record_source_entity_type_check in packages/db/src/schema/app.ts.
const entityCount = t.Object({ discovered: t.Number(), created: t.Number() });
const CountsResponse = t.Object({
  issue: entityCount,
  comment: entityCount,
  label: entityCount,
  state: entityCount,
  cycle: entityCount,
  attachment: entityCount,
});

export const ImportJobResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  source: t.Literal('plane'),
  phase: t.UnionEnum(['discover', 'create', 'link', 'rewrite', 'attachments', 'done']),
  status: t.UnionEnum(['pending', 'running', 'paused', 'completed', 'failed']),
  counts: CountsResponse,
  lastError: t.Nullable(t.String()),
  nextAttemptAt: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
});
