import type { RunnerConfig } from './config';

// The three calls the runner makes. The agent's API key is the whole authorization:
// it identifies the agent, and the server only ever hands back that agent's runs.

export interface Run {
  id: number;
  trigger: 'mention' | 'delegation' | 'schedule' | 'manual';
  prompt: string;
  systemPrompt: string;
  attempts: number;
  issueId: number | null;
  issueIdentifier: string | null;
}

// None of these calls does real work on the server, so a request that hangs is a dead
// connection. Without a deadline it would never settle and the runner would stop polling.
const REQUEST_TIMEOUT_MS = 30_000;

// Carries the status, so the caller can tell a rejected key from a server that is
// merely down.
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

  private async post(path: string, body?: unknown): Promise<Response> {
    const res = await fetch(`${this.config.url}${path}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

  async report(
    runId: number,
    result: { status: 'success' | 'failed'; output?: string; error?: string },
  ): Promise<void> {
    await this.post(`/agent-runs/${runId}/result`, result);
  }
}
