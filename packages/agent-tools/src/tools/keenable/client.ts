import { jsonOrThrow } from '../../http';

const KEENABLE_BASE = 'https://api.keenable.ai/v1';

export async function keenableRequest(
  path: string,
  body: Record<string, unknown> | null,
  what: string,
): Promise<unknown> {
  const res = await fetch(`${KEENABLE_BASE}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      // The public endpoints answer 400 to a call that does not name its app.
      'X-Keenable-Title': 'itsaplan',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return jsonOrThrow(res, what);
}
