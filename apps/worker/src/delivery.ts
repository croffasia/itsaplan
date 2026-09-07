import { pinnedFetch, UrlNotAllowedError } from '@repo/net';
import { signPayload } from './signature';

export interface DeliverInput {
  url: string;
  secret: string;
  deliveryId: number;
  eventId: string;
  eventType: string;
  body: string;
  timeoutMs: number;
}

export interface DeliveryResult {
  ok: boolean;
  // Only meaningful when ok is false: whether the failure is worth retrying.
  retryable?: boolean;
  status?: number;
  error?: string;
  // The receiver's response body, truncated. Absent on a network/timeout error.
  responseBody?: string;
}

// Response bodies are stored for the history view; cap what we keep.
const MAX_RESPONSE_CHARS = 2000;

// Which HTTP statuses are worth retrying: request timeout, rate limit, and any
// server error. Other 4xx are the receiver rejecting the request (bad URL, auth,
// gone) — retrying will not help, so they fail permanently.
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

// Posts the signed payload to the webhook URL with a hard timeout. A 2xx is
// success; a retryable status or a network/timeout error is a transient failure;
// anything else is a permanent failure.
export async function deliver(input: DeliverInput): Promise<DeliveryResult> {
  const ts = Math.floor(Date.now() / 1000);
  const signature = signPayload(input.secret, ts, input.body);
  try {
    // Re-checked here, not only at registration: the url was validated when it was
    // stored, but the hostname it resolves to can have changed since.
    const res = await pinnedFetch(input.url, {
      method: 'POST',
      timeoutMs: input.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'itsaplan-webhooks/1',
        'X-Itsaplan-Event': input.eventType,
        'X-Itsaplan-Delivery': String(input.deliveryId),
        'X-Itsaplan-Event-Id': input.eventId,
        'X-Itsaplan-Signature': signature,
      },
      body: input.body,
    });
    const responseBody = (await res.text().catch(() => '')).slice(0, MAX_RESPONSE_CHARS);
    if (res.status >= 200 && res.status < 300)
      return { ok: true, status: res.status, responseBody };
    return {
      ok: false,
      retryable: isRetryableStatus(res.status),
      status: res.status,
      error: `HTTP ${res.status}`,
      responseBody,
    };
  } catch (err) {
    // A url that no longer passes the guard is permanent; a network error, DNS
    // failure, or the timeout is transient.
    return {
      ok: false,
      retryable: !(err instanceof UrlNotAllowedError),
      error: err instanceof Error ? err.message : 'request failed',
    };
  }
}
