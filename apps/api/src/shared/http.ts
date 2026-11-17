// A 204 No Content response. Elysia serializes returned values, so deletes return
// this explicit empty response instead of a body.
export const noContent = () => new Response(null, { status: 204 });

// One Server-Sent Events frame: the JSON-encoded value, with the event id a client
// passes back to resume from where it stopped when the caller numbers its events.
export function sseFrame(data: unknown, id?: number): string {
  const idLine = id === undefined ? '' : `id: ${id}\n`;
  return `${idLine}data: ${JSON.stringify(data)}\n\n`;
}

// Under Bun's idle timeout for a quiet stream (30 s as Elysia sets it, checked every 4 s, so
// up to 4 s early) and under a proxy's read timeout.
export const SSE_HEARTBEAT_MS = 10_000;

// Streams frames as Server-Sent Events. Returned as a raw Response, so a route serving
// one declares `200: t.Any()` — it is not a JSON shape the validator can describe.
export function sseResponse(frames: AsyncIterable<string>): Response {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const restartHeartbeat = () => {
        clearTimeout(heartbeat);
        heartbeat = setTimeout(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
            restartHeartbeat();
          } catch {
            // The stream is closed: there is nothing left to keep open.
          }
        }, SSE_HEARTBEAT_MS);
      };
      restartHeartbeat();
      try {
        for await (const frame of frames) {
          // The consumer cancelled (e.g. closed the chat): stop consuming the source
          // instead of enqueuing onto a closed controller.
          if (controller.desiredSize === null) return;
          controller.enqueue(encoder.encode(frame));
          restartHeartbeat();
        }
        controller.close();
      } finally {
        clearTimeout(heartbeat);
      }
    },
    cancel() {
      clearTimeout(heartbeat);
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // A proxy that buffers the response would hold it back until it ends, which is
      // the one thing an event stream exists to avoid.
      'X-Accel-Buffering': 'no',
    },
  });
}
