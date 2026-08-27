import type { AgUiEvent, ContextUsage } from './agui';
import type { RunnerConfig } from './config';

// The agent's API key is the whole authorization: it identifies the agent, and the server
// only ever hands back that agent's work.

export interface Run {
  id: number;
  trigger: 'mention' | 'delegation' | 'field' | 'schedule' | 'manual';
  prompt: string;
  systemPrompt: string;
  issueId: number | null;
  issueIdentifier: string | null;
}

// `prompt` carries the conversation so far framed into a task — unless `sessionId` is set,
// where the coding agent session already holds it and only the new message is sent. Null
// there means no session yet: start one and report the id it got.
export interface ChatMessage {
  id: number;
  threadId: string;
  prompt: string;
  systemPrompt: string;
  sessionId: string | null;
}

// None of these calls does real work on the server, so a request that hangs is a dead
// connection. Without a deadline it would never settle and the runner would stop polling.
const REQUEST_TIMEOUT_MS = 30_000;

// Claiming a chat message is the one call that does wait: the server holds it until a
// message turns up, so the answer starts the moment it is sent. The deadline has to
// outlast that wait, or the runner would abort every idle claim.
const CHAT_CLAIM_TIMEOUT_MS = 35_000;

// The status is carried so the caller can tell a rejected key from a server that is down.
export class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class Client {
  constructor(private readonly config: RunnerConfig) {}

  private async post(
    path: string,
    body?: unknown,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<Response> {
    const res = await fetch(`${this.config.url}${path}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new RequestError(
        res.status,
        `POST ${path} failed with ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
    }
    return res;
  }

  async claim(): Promise<Run | null> {
    const res = await this.post('/agent-runs/claim');
    const body = (await res.json()) as { run: Run | null };
    return body.run;
  }

  async heartbeat(runId: number): Promise<void> {
    await this.post(`/agent-runs/${runId}/heartbeat`);
  }

  // `usage` is what the last model call of the run read and wrote. Left out where the
  // command reported nothing about it, which stores the run without counts.
  async report(
    runId: number,
    result: {
      status: 'success' | 'failed';
      output?: string;
      error?: string;
      usage?: ContextUsage | null;
    },
  ): Promise<void> {
    await this.post(`/agent-runs/${runId}/result`, result);
  }

  async claimChat(): Promise<ChatMessage | null> {
    const res = await this.post('/agent-chats/claim', undefined, CHAT_CLAIM_TIMEOUT_MS);
    const body = (await res.json()) as { message: ChatMessage | null };
    return body.message;
  }

  // `sessionId` binds the thread to that session for every later message in it. True
  // when the member stopped the answer: the server has no connection to this machine, so
  // the stop is returned on the calls the runner already makes.
  async chatEvents(messageId: number, events: AgUiEvent[], sessionId?: string): Promise<boolean> {
    const res = await this.post(`/agent-chats/${messageId}/events`, {
      events,
      ...(sessionId && { sessionId }),
    });
    return canceled(res);
  }

  // True when the member stopped the answer. This is how a command that is writing
  // nothing learns of the stop.
  async chatHeartbeat(messageId: number): Promise<boolean> {
    return canceled(await this.post(`/agent-chats/${messageId}/heartbeat`));
  }

  // `usage` is the size of the context the answer left behind. Left out where the
  // command reported nothing about it, which keeps the number the thread already has.
  async chatResult(
    messageId: number,
    result: { status: 'success' | 'failed'; error?: string; usage?: ContextUsage | null },
  ): Promise<void> {
    await this.post(`/agent-chats/${messageId}/result`, result);
  }
}

// An instance too old to know about stopping answers this with 204 and no body, which
// reads the same way as an answer nobody stopped.
async function canceled(res: Response): Promise<boolean> {
  const body = (await res.json().catch(() => ({}))) as { canceled?: boolean };
  return body.canceled === true;
}
