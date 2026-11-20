import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';
import { IssueAgentRunPageResponse, issueAgentTraceQuery } from '#modules/issues/model';
import { agentExecutionState } from '../model';

export const queueQuery = t.Object({
  ...pageQueryFields,
  runId: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  state: t.Optional(
    t.Union([t.Literal('failed'), t.Literal('active')], {
      description: "'failed' lists the failed runs; 'active' the waiting and running ones.",
    }),
  ),
  q: t.Optional(
    t.String({
      maxLength: 200,
      description:
        "Text to find in the issue's title or key, the schedule's name or the agent's username.",
    }),
  ),
  initiatorIds: t.Optional(
    t.String({
      pattern: '^[A-Za-z0-9_-]+(,[A-Za-z0-9_-]+)*$',
      maxLength: 5000,
      description: 'Comma-separated user ids; keeps the runs these people are the initiators of.',
    }),
  ),
  projectIds: t.Optional(
    t.String({
      pattern: '^[1-9][0-9]{0,8}(,[1-9][0-9]{0,8})*$',
      maxLength: 5000,
      description: 'Comma-separated project ids; keeps the runs of these projects.',
    }),
  ),
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
});
const person = { name: t.String(), image: t.Nullable(t.String()) };
const run = IssueAgentRunPageResponse.properties.items.items;
export const RunnerQueueResponse = t.Object({
  ...pageResponse(
    t.Object({
      ...run.properties,
      issueId: t.Nullable(t.Number()),
      sequenceNumber: t.Nullable(t.Number()),
      issueTitle: t.Nullable(t.String()),
      scheduleId: t.Nullable(t.Number()),
      scheduleName: t.Nullable(t.String()),
      projectRef: t.String(),
      document: t.Nullable(t.Object({ id: t.Number(), title: t.String() }), {
        description: 'The document whose comment started the run.',
      }),
      initiator: t.Nullable(t.Object({ id: t.String(), ...person }), {
        description: "The person the run works for; null for the project's own work.",
      }),
      startedBy: t.Nullable(
        t.Object({
          ...person,
          agentUsername: t.Nullable(t.String({ description: 'Set when an agent queued it.' })),
        }),
        {
          description:
            'Who queued the run or made the change that started it; null for a timed schedule.',
        },
      ),
      parentRun: t.Nullable(t.Object({ id: t.Number(), projectRef: t.String() }), {
        description: 'The run in which an agent queued this one.',
      }),
      rootRun: t.Nullable(
        t.Object({
          id: t.Number(),
          projectRef: t.String(),
          scheduleName: t.Nullable(t.String()),
          initiator: t.Nullable(t.Object(person), {
            description: "The first run's initiator; null for the project's own work.",
          }),
        }),
        { description: 'The first run of the chain this run is part of.' },
      ),
      canReadSteps: t.Boolean({
        description:
          "Whether the caller reads the run's steps, what its agent did: whoever runs the team, " +
          "an owner of the project, whoever may create or change its agents, and the run's initiator.",
      }),
      inputTokens: t.Nullable(t.Number({ description: 'What the last model call read.' })),
      outputTokens: t.Nullable(t.Number({ description: 'What the last model call wrote.' })),
      runnerState: t.Nullable(
        t.Union([t.Literal('push'), t.Literal('online'), t.Literal('offline'), t.Literal('never')]),
        {
          description:
            'How the run reaches its runner; null for an internal agent, which has none.',
        },
      ),
    }),
  ).properties,
  queued: t.Number(),
  running: t.Number(),
  failed: t.Number({ description: 'Failed runs that match every filter but `state`.' }),
});

export const RunInitiatorOptionsResponse = t.Array(t.Object({ id: t.String(), ...person }));
export const RunProjectOptionsResponse = t.Array(
  t.Object({ id: t.Number(), name: t.String(), ref: t.String() }),
);

export const internalTraceQuery = t.Object({
  ...issueAgentTraceQuery.properties,
  attempt: t.Optional(
    t.Numeric({
      minimum: 1,
      multipleOf: 1,
      description: 'The recorded attempt to read, oldest 1; the latest when absent.',
    }),
  ),
});

export const AgentRunResultResponse = t.Object({
  runId: t.Number(),
  status: agentExecutionState,
  output: t.Nullable(
    t.String({ description: "The agent's answer; the text it had produced for a failed run." }),
  ),
  error: t.Nullable(t.String({ description: 'Why the last attempt failed.' })),
  retryAfterSeconds: t.Optional(
    t.Number({ description: 'Seconds to wait before reading it again; absent once it ended.' }),
  ),
});

export const RunsInFlightResponse = t.Object({
  running: t.Number({
    description: "Runs of the workspace's internal agents in flight; the rest wait in the queue.",
  }),
  limit: t.Number({
    description:
      "The lower of the workspace's own limit and its plan's; 0 when neither is set. The instance's limit, over every workspace, is not in it.",
  }),
});
