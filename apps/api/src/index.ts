import { app } from './app';

const MB = 1024 * 1024;

// Bun reads a request body in full before any route runs, and the ceiling is one
// value for the whole server. An attachment upload has to fit under it with its
// multipart or base64 framing, so maxAttachmentMb (god mode) must stay below it.
function maxRequestBodySize(): number {
  const mb = Number(process.env.API_MAX_REQUEST_BODY_MB || 256);
  if (!Number.isInteger(mb) || mb <= 0) {
    throw new Error('API_MAX_REQUEST_BODY_MB must be a positive integer number of megabytes');
  }
  return mb * MB;
}

// Bind the port. The app itself is assembled in ./app.ts (without `.listen()`)
// so tests can import it and drive routes in memory.
app.listen({
  port: Number(process.env.API_PORT ?? 3000),
  maxRequestBodySize: maxRequestBodySize(),
});

console.log(`🦊 API running at http://${app.server?.hostname}:${app.server?.port}`);

export type { App } from './app';
