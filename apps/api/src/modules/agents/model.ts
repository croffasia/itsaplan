import { t } from 'elysia';

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

// The transcript of a chat, shared by both kinds of agent: an internal agent's
// conversations are held by the runtime's memory, an external agent's by the feed its
// runner drains, and the routes serving them return these shapes either way.

// One chat thread in the history list. `cliSessionId` belongs to an external agent's
// threads, where a runner keeps the session; an internal agent runs here and has none.
export type ChatThreadSummary = {
  id: string;
  title: string | null;
  cliSessionId: string | null;
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
