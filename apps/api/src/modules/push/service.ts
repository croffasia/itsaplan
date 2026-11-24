import { db, pushSubscription, user } from '@repo/db';
import { and, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import { assertPublicHttpUrl } from '#shared/net';

// The browsers a user turned Web Push on in. Every function here acts on the user it is
// given, and only on that user's rows.

// A subscription past this replaces the user's oldest, so one notification reaches a
// bounded number of endpoints.
const MAX_PUSH_SUBSCRIPTIONS = 10;

export interface PushSubscriptionDto {
  id: number;
  endpoint: string;
  createdAt: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function toDto(row: { id: number; endpoint: string; createdAt: Date }): PushSubscriptionDto {
  return { id: row.id, endpoint: row.endpoint, createdAt: iso(row.createdAt) };
}

// The browser chose the endpoint and the worker POSTs to it. Every push service is on the
// public internet, and any member may subscribe, so the endpoint gets the public-only
// policy: no host SSRF_ALLOWED_HOSTS trusts either. That policy lets http through, so
// https is required here.
async function assertEndpoint(endpoint: string): Promise<void> {
  const url = await assertPublicHttpUrl(endpoint, { publicOnly: true });
  if (url.protocol !== 'https:') throw new HttpError(400, 'url must use https');
}

// The uncompressed form RFC 8291 encrypts to: 0x04, then the two coordinates. The import
// refuses a point that is not on the curve.
async function isP256Point(bytes: Uint8Array<ArrayBuffer>): Promise<boolean> {
  if (bytes.length !== 65 || bytes[0] !== 0x04) return false;
  try {
    await crypto.subtle.importKey('raw', bytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    return true;
  } catch {
    return false;
  }
}

// The keys the worker encrypts every payload to. A wrong one would fail each delivery.
async function assertKeys(keys: PushSubscriptionInput['keys']): Promise<void> {
  if (Buffer.from(keys.auth, 'base64url').length !== 16) {
    throw new HttpError(400, 'keys.auth must be 16 bytes');
  }
  if (!(await isP256Point(new Uint8Array(Buffer.from(keys.p256dh, 'base64url'))))) {
    throw new HttpError(400, 'keys.p256dh must be an uncompressed P-256 public key');
  }
}

export async function listPushSubscriptions(userId: string): Promise<PushSubscriptionDto[]> {
  const rows = await db
    .select({
      id: pushSubscription.id,
      endpoint: pushSubscription.endpoint,
      createdAt: pushSubscription.createdAt,
    })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId))
    .orderBy(desc(pushSubscription.createdAt), desc(pushSubscription.id));
  return rows.map(toDto);
}

// Stores a subscription made with the instance's VAPID public key, or updates the
// user's own row with the same endpoint. An endpoint another user holds is refused
// rather than taken over.
export async function savePushSubscription(
  userId: string,
  input: PushSubscriptionInput,
  vapidPublicKey: string,
): Promise<PushSubscriptionDto> {
  await assertEndpoint(input.endpoint);
  await assertKeys(input.keys);
  const values = { p256dh: input.keys.p256dh, auth: input.keys.auth, vapidPublicKey };
  return db.transaction(async (tx) => {
    // Two subscribes of one user at once would each count the rows without the other's.
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update');
    const [row] = await tx
      .insert(pushSubscription)
      .values({ userId, endpoint: input.endpoint, ...values })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: values,
        setWhere: eq(pushSubscription.userId, userId),
      })
      .returning();
    if (!row) throw new HttpError(409, 'This push subscription belongs to another account');
    const newest = tx
      .select({ id: pushSubscription.id })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, userId))
      .orderBy(desc(pushSubscription.createdAt), desc(pushSubscription.id))
      .limit(MAX_PUSH_SUBSCRIPTIONS);
    await tx
      .delete(pushSubscription)
      .where(and(eq(pushSubscription.userId, userId), notInArray(pushSubscription.id, newest)));
    return toDto(row);
  });
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscription)
    .where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));
}

// The subscription ids of several users at once, for the notification enqueue path:
// only those made with the instance's current VAPID public key, since a push service
// refuses this instance's token for any other. A user with none is absent from the map.
export async function getPushSubscriptionIds(
  userIds: string[],
  vapidPublicKey: string,
): Promise<Map<string, number[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ id: pushSubscription.id, userId: pushSubscription.userId })
    .from(pushSubscription)
    .where(
      and(
        inArray(pushSubscription.userId, userIds),
        eq(pushSubscription.vapidPublicKey, vapidPublicKey),
      ),
    );
  const map = new Map<string, number[]>();
  for (const row of rows) map.set(row.userId, [...(map.get(row.userId) ?? []), row.id]);
  return map;
}
