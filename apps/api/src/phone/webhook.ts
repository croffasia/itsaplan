import { Elysia, t } from 'elysia';
import { HttpError } from '../shared/lib';
import { noContent } from '../shared/http';
import { recordCallEvent } from './store';

// The endpoint Rinkel posts call events to. It is public, because Rinkel signs
// nothing and sends no credentials: the secret is the url itself, so the token in
// the path is what stands between the internet and this handler. Without
// PHONE_WEBHOOK_TOKEN set, the route accepts nothing at all.
//
// Rinkel documents the body only as { event, payload } with an untyped payload, so
// the whole body is stored and the fields below are read out of it defensively.

function pick(source: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value) return value;
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      for (const inner of ['localized', 'e164', 'number', 'id']) {
        const candidate = nested[inner];
        if (typeof candidate === 'string' && candidate) return candidate;
      }
    }
  }
  return null;
}

export const phoneWebhookRoutes = new Elysia({
  name: 'phone-webhook',
  detail: { tags: ['Phone'] },
}).post(
  '/phone/webhook/:token',
  async ({ params, body }) => {
    const expected = process.env.PHONE_WEBHOOK_TOKEN;
    // Not configured and a wrong token look the same from outside, so the url
    // cannot be probed for whether the feature is on.
    if (!expected || params.token !== expected) throw new HttpError(404, 'Not found');

    const payload = (body.payload ?? {}) as Record<string, unknown>;
    await recordCallEvent({
      event: body.event,
      callId: pick(payload, 'callId', 'call_id', 'id'),
      direction: pick(payload, 'direction'),
      externalNumber: pick(payload, 'externalNumber', 'from', 'caller'),
      internalNumber: pick(payload, 'internalNumber', 'to', 'callee'),
      payload: { event: body.event, payload },
    });
    return noContent();
  },
  {
    params: t.Object({ token: t.String() }),
    body: t.Object({ event: t.String(), payload: t.Optional(t.Any()) }),
    detail: { summary: 'Receive a call event from Rinkel' },
  },
);
