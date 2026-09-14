import { createHash, timingSafeEqual } from 'node:crypto';

export const BOB_ACTOR = 'bob-agent';

export class BobMcpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function constantTimeTokenMatches(candidate: string, expected: string): boolean {
  if (!candidate || !expected) return false;
  const candidateHash = createHash('sha256').update(candidate).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

export function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization');
  const match = value?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

export function sanitizeErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (
      typeof code === 'string' &&
      ['forbidden', 'not_found', 'invalid_request', 'rate_limited', 'timeout'].includes(code)
    ) {
      return code;
    }
  }
  return 'internal_error';
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BobMcpError('timeout', 'Request timed out')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface AuditEvent {
  actor: typeof BOB_ACTOR;
  requestId: string;
  toolName: string;
  projectId: number | null;
  resourceId: string | null;
  resultStatus: 'success' | 'error' | 'denied';
  durationMs: number;
  recordCount: number;
  errorCode: string | null;
}

export function createAuditEvent(input: Omit<AuditEvent, 'actor'>): AuditEvent {
  return { actor: BOB_ACTOR, ...input };
}
