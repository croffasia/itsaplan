import { afterEach, describe, it, expect, jest } from 'bun:test';
import { noContent, SSE_HEARTBEAT_MS, sseResponse } from '../../http';

describe('noContent', () => {
  it('is a 204 response with an empty body', () => {
    const res = noContent();
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });
});

// A source that yields what the test pushes, and waits in between.
function pushedFrames() {
  const queued: string[] = [];
  let wake: (() => void) | undefined;
  async function* frames() {
    for (;;) {
      while (queued.length > 0) yield queued.shift()!;
      await new Promise<void>((resolve) => (wake = resolve));
    }
  }
  const push = (frame: string) => {
    queued.push(frame);
    wake?.();
  };
  return { frames: frames(), push };
}

describe('sseResponse', () => {
  afterEach(() => jest.useRealTimers());

  it('sends a comment frame while the source has nothing, before its first frame too', async () => {
    jest.useFakeTimers();
    const source = pushedFrames();
    const reader = sseResponse(source.frames)
      .body!.pipeThrough(new TextDecoderStream())
      .getReader();

    jest.advanceTimersByTime(SSE_HEARTBEAT_MS);
    expect((await reader.read()).value).toBe(': ping\n\n');
    jest.advanceTimersByTime(SSE_HEARTBEAT_MS);
    expect((await reader.read()).value).toBe(': ping\n\n');
    await reader.cancel();
  });

  it('restarts the wait on every frame, so frames that keep coming get no comment', async () => {
    jest.useFakeTimers();
    const source = pushedFrames();
    const reader = sseResponse(source.frames)
      .body!.pipeThrough(new TextDecoderStream())
      .getReader();

    jest.advanceTimersByTime(SSE_HEARTBEAT_MS - 1_000);
    source.push('data: 1\n\n');
    expect((await reader.read()).value).toBe('data: 1\n\n');
    jest.advanceTimersByTime(SSE_HEARTBEAT_MS - 1_000);
    source.push('data: 2\n\n');
    expect((await reader.read()).value).toBe('data: 2\n\n');

    jest.advanceTimersByTime(SSE_HEARTBEAT_MS);
    expect((await reader.read()).value).toBe(': ping\n\n');
    await reader.cancel();
  });
});
