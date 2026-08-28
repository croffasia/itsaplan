import { t } from 'elysia';

import type { ThreadMatch } from './chat-history';

// Shared by every route in the domain that addresses an agent by its id.
export const agentParams = t.Object({
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
