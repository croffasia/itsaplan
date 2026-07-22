import { createHmac } from 'node:crypto';

// HMAC-SHA256 over `${timestamp}.${body}` with the webhook's secret, formatted as
// the X-Itsaplan-Signature header value (`t=<ts>,v1=<hex>`). The timestamp lets
// the receiver reject replays; the receiver recomputes the HMAC over the exact
// bytes it received and compares in constant time.
export function signPayload(secret: string, timestampSeconds: number, body: string): string {
  const digest = createHmac('sha256', secret).update(`${timestampSeconds}.${body}`).digest('hex');
  return `t=${timestampSeconds},v1=${digest}`;
}
