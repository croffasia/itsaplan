import { t } from 'elysia';

import { contextUsageBody } from '../model';

export { agentParams } from '../model';

// A chat with an external agent is carried by AG-UI events (https://docs.ag-ui.com):
// the runner reports what its coding agent produces as this event stream, and the
// browser is served the same events. The schemas below are the subset the chat needs,
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

export const chatMessageParams = t.Object({
  projectKey: t.String(),
  agentId: t.Numeric(),
  messageId: t.Numeric(),
});

export const runnerMessageParams = t.Object({ messageId: t.Numeric() });

export const sendChatBody = t.Object({
  prompt: t.String({ minLength: 1, description: 'Message to send the agent.' }),
  threadId: t.Optional(
    t.String({ description: 'Thread id of an earlier message, to continue that conversation.' }),
  ),
});

// What the caller needs to follow the answer: the thread it belongs to and the id of
// the answer being produced.
export const SendChatResponse = t.Object({
  threadId: t.String(),
  messageId: t.Number(),
});

// Events are read with a cursor: `after` is the id of the last event already seen.
export const chatEventsQuery = t.Object({ after: t.Optional(t.Numeric({ minimum: 0 })) });

// Where an answer stands: queued, being produced by a runner, or closed — finished,
// failed, or stopped from the chat.
export const chatMessageStatus = t.Union([
  t.Literal('pending'),
  t.Literal('streaming'),
  t.Literal('success'),
  t.Literal('failed'),
  t.Literal('canceled'),
]);

export type ChatMessageStatus = typeof chatMessageStatus.static;

export const ChatEventsResponse = t.Object({
  items: t.Array(t.Object({ id: t.Number(), event: AgUiEvent })),
  status: chatMessageStatus,
  error: t.Nullable(t.String()),
  nextCursor: t.Nullable(t.Number()),
  hasMore: t.Boolean(),
});

// The claimed answer, or null when the agent has nothing waiting. `prompt` carries the
// conversation so far, framed the same way a run's task is — except when `sessionId` is
// set, where the runner's session already holds it and only the new message is sent.
export const ClaimChatResponse = t.Object({
  message: t.Nullable(
    t.Object({
      id: t.Number(),
      threadId: t.String(),
      prompt: t.String(),
      systemPrompt: t.String(),
      attempts: t.Number(),
      sessionId: t.Nullable(
        t.String({
          description:
            "The coding agent session this thread is bound to on the runner's machine. " +
            'Null when there is none yet: start a fresh one and report the id it got.',
        }),
      ),
    }),
  ),
});

export const chatEventsBody = t.Object({
  events: t.Array(AgUiEvent, { minItems: 1, maxItems: 200 }),
  sessionId: t.Optional(
    t.String({
      maxLength: 200,
      description:
        'The session the runner started for this thread, reported once so later messages ' +
        'in it resume that session instead of being sent the conversation again.',
    }),
  ),
});

// `usage` is the size of the context this answer left behind. A null one is shown as a
// dash in the chat.
export const chatResultBody = t.Object({
  status: t.Union([t.Literal('success'), t.Literal('failed')]),
  error: t.Optional(t.Nullable(t.String())),
  usage: contextUsageBody,
});

// The answer of every runner call that reports progress. `canceled` is how the stop
// reaches the runner: it is returned on the calls the runner already makes, so the
// server needs no connection to the operator's machine.
export const ChatAckResponse = t.Object({
  canceled: t.Boolean({
    description: 'The answer was stopped from the chat: kill the command and stop reporting.',
  }),
});
