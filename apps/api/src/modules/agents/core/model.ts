import { t } from 'elysia';

import { pageQueryFields, pageResponse } from '#shared/pagination';
import { agentRunTrigger, runContextTokens } from '../model';

export { agentParams, projectAgentParams } from '../model';

export const threadParams = t.Object({
  projectKey: t.String(),
  agentId: t.Numeric(),
  threadId: t.String(),
});

// Body of the interactive run endpoints. threadId continues a conversation when the
// agent has memory enabled; omit it to start a new thread (the id used is returned in
// the response).
export const runBody = t.Object({
  prompt: t.String({ minLength: 1, description: 'Message to send the agent.' }),
  threadId: t.Optional(
    t.String({ description: 'Thread id from an earlier run, to continue that conversation.' }),
  ),
});

// A username is a short handle used to address the agent; keep it URL/mention safe.
const username = t.String({
  minLength: 1,
  maxLength: 64,
  pattern: '^[a-zA-Z0-9._-]+$',
  description: 'Mention handle (letters, digits, . _ -).',
});

// Internal-agent model configuration, all optional so a config can be filled in
// over time. Ignored (stored as null/empty) for an external agent.
const configFields = {
  modelCredentialId: t.Optional(
    t.Nullable(
      t.Number({
        description:
          'Credential id of the LLM provider, from list_integration_credentials. Required for an ' +
          'internal agent to run.',
      }),
    ),
  ),
  model: t.Optional(
    t.Nullable(
      t.String({
        description:
          "Model id the provider offers, from list_provider_models, e.g. 'claude-sonnet-5'.",
      }),
    ),
  ),
  instructions: t.Optional(t.Nullable(t.String({ description: 'System prompt for the agent.' }))),
  tools: t.Optional(
    t.Array(t.String(), {
      description:
        'Built-in action keys from list_ai_agent_tools the agent is granted. Tools on an ' +
        'integration are granted separately, through set_ai_agent_configured_tools.',
    }),
  ),
  temperature: t.Optional(t.Nullable(t.Number({ description: 'Sampling temperature.' }))),
  maxSteps: t.Optional(t.Nullable(t.Integer({ description: 'Max tool-call steps per run.' }))),
  memoryEnabled: t.Optional(
    t.Boolean({ description: 'Keep conversation memory across a thread.' }),
  ),
  memoryLastMessages: t.Optional(
    t.Nullable(t.Integer({ minimum: 1, description: 'How many recent messages to recall.' })),
  ),
  triggerOnMention: t.Optional(t.Boolean({ description: 'Run when @-mentioned in a comment.' })),
  triggerOnAssign: t.Optional(t.Boolean({ description: 'Run when assigned to an issue.' })),
  fieldTriggers: t.Optional(
    t.Array(
      t.Object({
        fieldId: t.Integer(),
        delaySec: t.Integer({ minimum: 0, maximum: 86400 }),
      }),
      {
        description:
          'Member custom fields (from list_custom_fields) the agent also reacts to: being set ' +
          'into one of them starts a run after delaySec seconds. Other fields are ignored.',
      },
    ),
  ),
  delegationDelaySec: t.Optional(
    t.Integer({
      minimum: 0,
      maximum: 86400,
      description: 'Seconds a delegation run waits before the agent may pick it up.',
    }),
  ),
  projectIds: t.Optional(
    t.Array(t.Integer(), {
      description:
        'Projects of the team the agent works in, from list_projects. Replaces the set: a ' +
        'project left out is detached. A project of another team is rejected. The agent ' +
        "joins on the team's default role; set_member_role changes it per project.",
    }),
  ),
  runnerScope: t.Optional(
    t.Union([t.Literal('owner'), t.Literal('team')], {
      description:
        "Which runs an external agent's runner receives: 'owner' only the creator's, " +
        "'team' any member's.",
    }),
  ),
};

// An agent DTO (AiAgentRow from the service).
export const AiAgentResponse = t.Object({
  id: t.Number(),
  teamId: t.Number(),
  projects: t.Array(t.Object({ id: t.Number(), key: t.String(), name: t.String() }), {
    description: 'The projects of the team the agent works in.',
  }),
  userId: t.String(),
  name: t.String(),
  username: t.String(),
  kind: t.Union([t.Literal('external'), t.Literal('internal')]),
  modelCredentialId: t.Nullable(t.Number()),
  model: t.Nullable(t.String()),
  instructions: t.Nullable(t.String()),
  tools: t.Array(t.String()),
  temperature: t.Nullable(t.Number()),
  maxSteps: t.Nullable(t.Number()),
  memoryEnabled: t.Boolean(),
  memoryLastMessages: t.Nullable(t.Number()),
  triggerOnMention: t.Boolean(),
  triggerOnAssign: t.Boolean(),
  fieldTriggers: t.Array(t.Object({ fieldId: t.Number(), name: t.String(), delaySec: t.Number() })),
  delegationDelaySec: t.Number(),
  ownerUserId: t.Nullable(t.String()),
  runnerScope: t.Union([t.Literal('owner'), t.Literal('team')]),
  lastSeenAt: t.Nullable(t.String()),
  createdAt: t.String(),
  apiKeyStart: t.Nullable(t.String()),
  modelProvider: t.Nullable(t.String()),
  actionCount: t.Number(),
  skillCount: t.Number(),
  toolCount: t.Number(),
});

// createAgent's result: the agent plus its one-time API key secret (null for an
// internal agent, which has no key).
export const CreateAgentResponse = t.Object({
  agent: AiAgentResponse,
  apiKey: t.Nullable(t.String()),
});

// The new API key secret returned once by regenerate-key.
export const RegenerateKeyResponse = t.Object({ apiKey: t.String() });

// A run's generated text and the conversation thread id (null when memory is off).
export const RunAgentResponse = t.Object({
  text: t.String(),
  threadId: t.Nullable(t.String()),
});

// One row of an agent's run history (AgentRunRow from run-queue).
export const AgentRunResponse = t.Object({
  id: t.Number(),
  status: t.String(),
  trigger: agentRunTrigger,
  issueId: t.Nullable(t.Number()),
  issueIdentifier: t.Nullable(t.String()),
  issueTitle: t.Nullable(t.String()),
  prompt: t.String(),
  attempts: t.Number(),
  lastError: t.Nullable(t.String()),
  output: t.Nullable(t.String()),
  contextTokens: runContextTokens,
  nextAttemptAt: t.String(),
  createdAt: t.String(),
});

// One page of an agent's runs (AgentRunPage from run-queue).
export const AgentRunPageResponse = t.Object({
  items: t.Array(AgentRunResponse),
  nextCursor: t.Nullable(t.Number()),
});

// One chat thread in the caller's history with an agent (ChatThreadSummary).
export const ChatThreadResponse = t.Object({
  id: t.String(),
  title: t.Nullable(t.String()),
  cliSessionId: t.Nullable(
    t.String({
      description:
        "The coding agent session an external agent's runner keeps for this thread on its " +
        'own machine. Always null for an internal agent, which runs in this process.',
    }),
  ),
  contextTokens: t.Optional(
    t.Nullable(
      t.Number({
        description:
          'The tokens the last completed answer of this thread read and wrote, which is ' +
          'the size of its context. Absent while no answer has completed; null where the ' +
          'agent reports no counts that can be read as a context size.',
      }),
    ),
  ),
  favorite: t.Boolean({ description: 'Whether the caller starred this conversation.' }),
  snippet: t.Optional(
    t.String({ description: 'Search only: the text around the match in a message.' }),
  ),
  match: t.Optional(
    t.Union([t.Literal('title'), t.Literal('user'), t.Literal('assistant')], {
      description:
        "Search only: where the match was found — the title, the member's message, or the agent's reply.",
    }),
  ),
  createdAt: t.String(),
  updatedAt: t.String(),
});

// One piece of a message (ChatPart): a stretch of text, or a tool the agent called
// between two of them, with what it was given and what it answered where the agent
// reported them.
const ChatPartResponse = t.Union([
  t.Object({ type: t.Literal('text'), text: t.String() }),
  t.Object({
    type: t.Literal('tool'),
    toolCallId: t.String(),
    toolName: t.String(),
    args: t.Optional(t.String()),
    result: t.Optional(t.String()),
  }),
]);

// One page of a chat thread's transcript (ChatMessagePage).
export const ChatMessagesResponse = t.Object({
  items: t.Array(
    t.Object({
      id: t.String(),
      role: t.Union([t.Literal('user'), t.Literal('assistant')]),
      parts: t.Array(ChatPartResponse),
      createdAt: t.String(),
      stopped: t.Optional(t.Boolean()),
    }),
  ),
  nextPage: t.Nullable(t.Number()),
});

export const AiAgentListResponse = t.Array(AiAgentResponse);

// One page of a caller's chat threads with an agent (ChatThreadPage).
export const ChatThreadListResponse = t.Object({
  items: t.Array(ChatThreadResponse),
  nextPage: t.Nullable(t.Number()),
});

export const createAgentBody = t.Object({
  name: t.String({ minLength: 1, description: 'Display name.' }),
  username,
  kind: t.Union([t.Literal('external'), t.Literal('internal')], {
    description: "'external' (API key) or 'internal' (in-process, needs a model config).",
  }),
  ...configFields,
});

export const updateAgentBody = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  username: t.Optional(username),
  ...configFields,
});

// The team agent list, optionally narrowed to the agents working in one project.
export const agentListQuery = t.Object({
  projectId: t.Optional(t.Numeric({ description: 'Only the agents working in this project.' })),
});

export const setAgentProjectsBody = t.Object({
  projectIds: t.Array(t.Integer(), {
    description:
      'Projects of the team the agent works in. Replaces the set: a project left out is ' +
      "detached. The agent joins on the team's default role; set_member_role changes it per " +
      'project.',
  }),
});

export const runsQuery = t.Object({
  before: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export const renameThreadBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 80, description: 'New title of the conversation.' }),
});

// Both the thread list and a thread's transcript are read a page at a time.
export const threadPageQuery = t.Object({ page: t.Optional(t.Numeric({ minimum: 0 })) });

// The history list also searches and shows the starred conversations. `favorites` is a
// group of its own: it is not paginated and ignores the page.
export const threadListQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 0 })),
  q: t.Optional(
    t.String({
      description:
        'Case-insensitive substring, matched against the thread title and the message text of ' +
        'both roles. Shorter than two characters searches nothing.',
    }),
  ),
  favorites: t.Optional(
    t.Boolean({ description: 'Return the starred conversations instead of the page.' }),
  ),
});

// The trace of one run of an internal agent (TraceSummary from runtime/traces).
export const AgentTraceResponse = t.Object({
  traceId: t.String(),
  name: t.String(),
  status: t.String({ description: "How the run ended: 'success', 'failed' or 'running'." }),
  startedAt: t.String(),
  endedAt: t.Nullable(t.String()),
  durationMs: t.Nullable(t.Number()),
  projectId: t.Nullable(t.Number()),
  runId: t.Nullable(
    t.Number({
      description:
        'The queued run this traced, as listed by the run history. Null for a trace of the ' +
        'test chat, which is queued nowhere.',
    }),
  ),
  trigger: t.Nullable(agentRunTrigger),
  issueId: t.Nullable(t.Number()),
});

export const AgentTracePageResponse = pageResponse(AgentTraceResponse);

// One step of a trace: the run itself, a model call, or a tool call (TraceSpan).
export const AgentTraceSpanResponse = t.Object({
  spanId: t.String(),
  parentSpanId: t.Nullable(t.String()),
  name: t.String(),
  type: t.String({
    description: "What the step is: 'agent_run', 'model_generation', 'tool_call'.",
  }),
  status: t.String(),
  startedAt: t.String(),
  endedAt: t.Nullable(t.String()),
  durationMs: t.Nullable(t.Number()),
  input: t.Any(),
  output: t.Any(),
  error: t.Any(),
  attributes: t.Any({
    description:
      'What the step itself reports: the model and its token counts for a model call, the ' +
      'arguments for a tool call.',
  }),
});

export const AgentTraceDetailResponse = t.Object({
  trace: AgentTraceResponse,
  spans: t.Array(AgentTraceSpanResponse),
});

// The trace list pages, and reads one project of the agent's when projectId is given.
export const tracesQuery = t.Object({
  projectId: t.Optional(t.Numeric()),
  ...pageQueryFields,
});

export const traceParams = t.Object({
  teamId: t.Numeric(),
  agentId: t.Numeric(),
  traceId: t.String(),
});

// --- Agent analytics -------------------------------------------------------------

// Cost is in USD, and null where the price table names no such provider and model —
// the panel shows the tokens without an amount rather than a wrong one.
const analyticsCost = t.Nullable(t.Number());

const AgentAnalyticsTotals = t.Object({
  runs: t.Number(),
  errors: t.Number(),
  inputTokens: t.Number(),
  outputTokens: t.Number(),
  toolCalls: t.Number(),
  cost: analyticsCost,
});

export const AgentAnalyticsResponse = t.Object({
  from: t.String(),
  to: t.String(),
  totals: AgentAnalyticsTotals,
  previous: AgentAnalyticsTotals,
  threads: t.Number({ description: 'Conversation threads the agents hold now.' }),
  models: t.Array(
    t.Object({
      provider: t.String(),
      model: t.String(),
      calls: t.Number(),
      inputTokens: t.Number(),
      outputTokens: t.Number(),
      cost: analyticsCost,
    }),
  ),
  agents: t.Array(
    t.Object({
      agentId: t.Number(),
      name: t.String(),
      runs: t.Number(),
      errors: t.Number(),
      inputTokens: t.Number(),
      outputTokens: t.Number(),
      cost: analyticsCost,
    }),
  ),
  tokensPerDay: t.Array(
    t.Object({
      day: t.String(),
      inputTokens: t.Number(),
      outputTokens: t.Number(),
      cost: analyticsCost,
    }),
  ),
  tools: t.Array(t.Object({ name: t.String(), calls: t.Number(), errors: t.Number() })),
  latencyPerDay: t.Array(t.Object({ day: t.String(), p50: t.Number(), p95: t.Number() })),
});

// The window, in days back from now. The same number of days before it is read as
// well, which is what every headline figure is compared against.
export const analyticsQuery = t.Object({
  days: t.Optional(t.Numeric({ minimum: 1, maximum: 365 })),
});
