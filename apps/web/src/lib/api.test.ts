import { afterEach, describe, expect, it, mock } from 'bun:test';

process.env.NEXT_PUBLIC_API_URL = 'http://api.test';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Hermes conversation stream', () => {
  it('finishes on the done event without waiting for the HTTP connection to close', async () => {
    let close: (() => void) | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"type":"done","threadId":"conversation-id"}\n\n'),
        );
        close = () => controller.close();
      },
    });
    globalThis.fetch = mock(async () => new Response(body)) as unknown as typeof fetch;
    const { streamHermesConversation } = await import('./api');
    const stream = streamHermesConversation('VEX', 'conversation-id', 'Hello', crypto.randomUUID());

    expect(await stream.next()).toEqual({
      done: false,
      value: { type: 'done', threadId: 'conversation-id' },
    });

    const terminal = stream.next();
    const result = await Promise.race([
      terminal,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 25)),
    ]);
    if (result === 'timeout') close?.();
    await terminal;

    expect(result).toEqual({ done: true, value: undefined });
  });
});
