import { describe, it, expect, afterEach } from 'bun:test';
import { createHmac } from 'node:crypto';
import type { ChatMessage, Run } from '../client';
import { startListener, verifySignature, type ListenAgent, type Listener } from '../listen';

// The runner as an endpoint: a request is taken only when one of the configured agents
// signed it, and it then runs as that agent's task, within its concurrency, once.

function sign(secret: string, body: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
}

const run = (id: number): Run => ({
  id,
  attempts: 1,
  traceEvents: true,
  trigger: 'mention',
  prompt: 'p',
  systemPrompt: 's',
  issueId: 1,
  issueIdentifier: 'MKT-1',
});

const message: ChatMessage = {
  id: 7,
  threadId: 't',
  prompt: 'p',
  systemPrompt: 's',
  sessionId: null,
};

describe('verifySignature', () => {
  const body = '{"event":"ping"}';

  it('accepts the signature of the exact body', () => {
    expect(verifySignature('s1', sign('s1', body), body)).toBe(true);
  });

  it('refuses another secret, another body, and a malformed header', () => {
    expect(verifySignature('s2', sign('s1', body), body)).toBe(false);
    expect(verifySignature('s1', sign('s1', body), `${body} `)).toBe(false);
    expect(verifySignature('s1', 'v1=abc', body)).toBe(false);
    expect(verifySignature('s1', '', body)).toBe(false);
    const t = Math.floor(Date.now() / 1000);
    expect(verifySignature('s1', `t=${t},v1=${'é'.repeat(64)}`, body)).toBe(false);
  });

  it('refuses a request signed more than five minutes away from now', () => {
    const t = 1_700_000_000;
    expect(verifySignature('s1', sign('s1', body, t), body, t + 299)).toBe(true);
    expect(verifySignature('s1', sign('s1', body, t), body, t + 301)).toBe(false);
  });
});

describe('startListener', () => {
  let listener: Listener | null = null;

  afterEach(async () => {
    await listener?.close();
    listener = null;
  });

  function agent(secret: string, overrides: Partial<ListenAgent> = {}) {
    const seen = { runs: [] as Run[], chats: [] as ChatMessage[] };
    const value: ListenAgent = {
      secret,
      concurrency: 1,
      run: async (r) => void seen.runs.push(r),
      chat: async (m) => void seen.chats.push(m),
      ...overrides,
    };
    return { value, seen };
  }

  async function post(body: string, secret: string | null, method = 'POST') {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (secret) headers['x-itsaplan-signature'] = sign(secret, body);
    return fetch(`http://127.0.0.1:${listener!.port}/agent`, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
    });
  }

  it('hands a task to the agent whose secret signed it', async () => {
    const first = agent('secret-a');
    const second = agent('secret-b');
    listener = await startListener(0, [first.value, second.value], () => {});

    const res = await post(JSON.stringify({ event: 'agent.run', run: run(1) }), 'secret-b');
    expect(res.status).toBe(200);
    await post(JSON.stringify({ event: 'agent.chat', message }), 'secret-a');
    await Bun.sleep(10);

    expect(second.seen.runs.map((r) => r.id)).toEqual([1]);
    expect(first.seen.runs).toEqual([]);
    expect(first.seen.chats.map((m) => m.id)).toEqual([7]);
  });

  it('answers a ping and starts nothing', async () => {
    const only = agent('secret-a');
    listener = await startListener(0, [only.value], () => {});
    expect((await post('{"event":"ping"}', 'secret-a')).status).toBe(200);
    expect(only.seen.runs).toEqual([]);
  });

  it('refuses an unsigned request, a foreign secret, another method, and an unknown event', async () => {
    const only = agent('secret-a');
    listener = await startListener(0, [only.value], () => {});
    const body = JSON.stringify({ event: 'agent.run', run: run(1) });

    expect((await post(body, null)).status).toBe(401);
    expect((await post(body, 'secret-x')).status).toBe(401);
    expect((await post('', null, 'GET')).status).toBe(405);
    expect((await post('{"event":"agent.later"}', 'secret-a')).status).toBe(400);
    expect(only.seen.runs).toEqual([]);
  });

  it('refuses a body larger than a task can be', async () => {
    listener = await startListener(0, [agent('secret-a').value], () => {});
    const huge = JSON.stringify({ event: 'ping', pad: 'x'.repeat(6 * 1024 * 1024) });
    const res = await post(huge, 'secret-a').catch(() => null);
    // The server answers 413 and drops the connection, which a client may see as either.
    expect(res === null || res.status === 413).toBe(true);
  });

  it('runs the tasks one at a time at concurrency 1, and a task sent again only once', async () => {
    const started: number[] = [];
    let finishFirst!: () => void;
    const firstDone = new Promise<void>((resolve) => (finishFirst = resolve));
    const only = agent('secret-a', {
      run: async (r) => {
        started.push(r.id);
        if (r.id === 1) await firstDone;
      },
    });
    listener = await startListener(0, [only.value], () => {});

    await post(JSON.stringify({ event: 'agent.run', run: run(1) }), 'secret-a');
    await post(JSON.stringify({ event: 'agent.run', run: run(1) }), 'secret-a');
    await post(JSON.stringify({ event: 'agent.run', run: run(2) }), 'secret-a');
    await Bun.sleep(10);
    expect(started).toEqual([1]);

    finishFirst();
    await Bun.sleep(10);
    expect(started).toEqual([1, 2]);
  });

  it('waits for the tasks in flight when it closes', async () => {
    let finished = false;
    const only = agent('secret-a', {
      run: async () => {
        await Bun.sleep(50);
        finished = true;
      },
    });
    listener = await startListener(0, [only.value], () => {});
    await post(JSON.stringify({ event: 'agent.run', run: run(1) }), 'secret-a');

    await listener.close();
    listener = null;
    expect(finished).toBe(true);
  });
});
