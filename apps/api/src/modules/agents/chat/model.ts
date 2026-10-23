import { t } from 'elysia';

import { contextUsageBody, AgUiEvent } from '../model';

export { projectAgentParams } from '../model';

export { AgUiEvent, type AgUiEventBody } from '../model';

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
