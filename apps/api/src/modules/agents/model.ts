import { t } from 'elysia';

import type { ThreadMatch } from './chat-history';

// Shared by every route in the domain that addresses an agent by its id. An agent
// belongs to a team, so that is where it is addressed.
export const agentParams = t.Object({
  teamId: t.Numeric(),
  agentId: t.Numeric({ description: 'Agent id from list_ai_agents.' }),
});

// The same, for the routes that act on an agent inside one project of its team: a
// chat, and a run of an internal agent.
export const projectAgentParams = t.Object({
  projectKey: t.String(),
  agentId: t.Numeric({ description: 'Agent id from list_ai_agents.' }),
});

// What started a run, in the run history and in the queue a runner drains.
export const agentRunTrigger = t.Union([
  t.Literal('mention'),
  t.Literal('delegation'),
  t.Literal('field'),
  t.Literal('schedule'),
  t.Literal('manual'),
  t.Literal('status'),
  t.Literal('event'),
]);

export type AgentRunTrigger = typeof agentRunTrigger.static;

// The token counts of one run, in the agent's run history and in a schedule's. Shared
// by both listings, which return the same runs under different filters.
export const runContextTokens = t.Optional(
  t.Number({
    description:
      'The tokens the last model call of this run read and wrote. Absent for a run that ' +
      'finished before this was recorded and for one whose agent reports no counts.',
  }),
);

// What the last model call of an answer read, cache included, and what it wrote, as a
// runner reports it. Left out by a command that reported nothing about it, which leaves
// the counts already stored; null where the command reports none a context size can be
// read from. Shared by the chat result and the run result, which report the same thing.
export const contextUsageBody = t.Optional(
  t.Nullable(
    t.Object({
      inputTokens: t.Integer({ minimum: 0 }),
      outputTokens: t.Integer({ minimum: 0 }),
    }),
  ),
);

// The transcript of a chat, shared by both kinds of agent: an internal agent's
// conversations are held by the runtime's memory, an external agent's by the feed its
// runner drains, and the routes serving them return these shapes either way.

// One chat thread in the history list. `cliSessionId` belongs to an external agent's
// threads, where a runner keeps the session; an internal agent runs here and has none.
// `contextTokens` is the size of the conversation's context after its last completed
// answer: absent while no answer has completed, null where the agent reports no counts
// that can be read as one.
// `favorite` is the star the caller put on the conversation. `snippet` and `match` are
// set by a search: the text around the hit, and where it was found.
export type ChatThreadSummary = {
  id: string;
  title: string | null;
  cliSessionId: string | null;
  contextTokens?: number | null;
  favorite: boolean;
  snippet?: string;
  match?: ThreadMatch;
  createdAt: string;
  updatedAt: string;
};

// One piece of a message, in the order the agent produced it: what it wrote, and the
// tools it called between one stretch of text and the next. A call carries what it was
// given and what it answered where those are known — an agent that reports neither
// leaves both unset.
export type ChatPart =
  | { type: 'text'; text: string }
  | {
      type: 'tool';
      toolCallId: string;
      toolName: string;
      args?: string;
      result?: string;
    };

// One message of a conversation. Only user and assistant turns are returned; a tool
// turn is folded into the parts of the turn that called it. `stopped` marks an answer
// the member ended part-way.
export type ChatMessageDTO = {
  id: string;
  role: 'user' | 'assistant';
  parts: ChatPart[];
  createdAt: string;
  stopped?: boolean;
};

export type ChatMessagePage = {
  items: ChatMessageDTO[];
  nextPage: number | null;
};

export type ChatThreadPage = {
  items: ChatThreadSummary[];
  nextPage: number | null;
};

export const agentExecutionState = t.Union([
  t.Literal('queued'),
  t.Literal('running'),
  t.Literal('success'),
  t.Literal('failed'),
  t.Literal('canceled'),
]);

// External agent runs and chats are carried by AG-UI events (https://docs.ag-ui.com):
// the runner reports what its coding agent produces as this event stream, and the
// browser is served the same events. The schemas below are the subset the UI needs,
// with the field names the protocol defines, so a runner that already speaks AG-UI
// needs no translation. Lifecycle ids are optional here because the server knows the
// thread and the answer they belong to; everything else is required as specified.

// The longest text delta accepted in one event. A runner buffers its output rather
// than sending a request per token, and this bounds how much one event may carry.
const DELTA_LIMIT = 12_000;

// The longest arguments or result accepted for one tool call. A runner reports each of
// them whole, and cutting one breaks the JSON the chat indents and highlights.
const TOOL_TEXT_LIMIT = 32_000;

const RunStartedEvent = t.Object({
  type: t.Literal('RUN_STARTED'),
  threadId: t.Optional(t.String()),
  runId: t.Optional(t.String()),
});

const RunFinishedEvent = t.Object({
  type: t.Literal('RUN_FINISHED'),
  threadId: t.Optional(t.String()),
  runId: t.Optional(t.String()),
});

const RunErrorEvent = t.Object({
  type: t.Literal('RUN_ERROR'),
  message: t.String({ maxLength: 2000 }),
  code: t.Optional(t.String({ maxLength: 200 })),
});

const TextMessageStartEvent = t.Object({
  type: t.Literal('TEXT_MESSAGE_START'),
  messageId: t.String({ maxLength: 200 }),
  role: t.Literal('assistant'),
});

const TextMessageContentEvent = t.Object({
  type: t.Literal('TEXT_MESSAGE_CONTENT'),
  messageId: t.String({ maxLength: 200 }),
  delta: t.String({ maxLength: DELTA_LIMIT }),
});

const TextMessageEndEvent = t.Object({
  type: t.Literal('TEXT_MESSAGE_END'),
  messageId: t.String({ maxLength: 200 }),
});

const ToolCallStartEvent = t.Object({
  type: t.Literal('TOOL_CALL_START'),
  toolCallId: t.String({ maxLength: 200 }),
  toolCallName: t.String({ maxLength: 200 }),
  parentMessageId: t.Optional(t.String({ maxLength: 200 })),
});

const ToolCallArgsEvent = t.Object({
  type: t.Literal('TOOL_CALL_ARGS'),
  toolCallId: t.String({ maxLength: 200 }),
  delta: t.String({ maxLength: TOOL_TEXT_LIMIT }),
});

const ToolCallEndEvent = t.Object({
  type: t.Literal('TOOL_CALL_END'),
  toolCallId: t.String({ maxLength: 200 }),
});

const ToolCallResultEvent = t.Object({
  type: t.Literal('TOOL_CALL_RESULT'),
  messageId: t.String({ maxLength: 200 }),
  toolCallId: t.String({ maxLength: 200 }),
  content: t.String({ maxLength: TOOL_TEXT_LIMIT }),
  role: t.Optional(t.Literal('tool')),
});

export const AgUiEvent = t.Union([
  RunStartedEvent,
  RunFinishedEvent,
  RunErrorEvent,
  TextMessageStartEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  ToolCallStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallResultEvent,
]);

export type AgUiEventBody = typeof AgUiEvent.static;
