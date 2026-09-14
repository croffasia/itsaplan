import { BOB_ACTOR } from './security';

// One structured line per failed Bob MCP request. The client only ever receives a
// stable sanitized code, so without this the cause of a failure is invisible —
// which is exactly how a dead upstream dependency stayed hidden behind a generic
// "Request failed".
//
// This goes to the server log only. It carries the error's own message so an
// operator can act on it; it never carries the request body, the bearer token, a
// connection string, or a stack trace.
export interface BobFailureLog {
  requestId: string;
  toolName: string;
  durationMs: number;
  errorCode: string;
}

function detail(error: unknown): { errorName: string; errorMessage: string } {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message.slice(0, 500) };
  }
  return { errorName: 'Unknown', errorMessage: String(error).slice(0, 500) };
}

export function logBobFailure(entry: BobFailureLog, error: unknown): void {
  console.error(
    '[bob-mcp] request failed',
    JSON.stringify({ actor: BOB_ACTOR, ...entry, ...detail(error) }),
  );
}
