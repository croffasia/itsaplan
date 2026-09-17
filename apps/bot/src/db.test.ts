import { describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { db, user, userTelegramAccount } from '@repo/db';
import { confirmTelegramLink } from './db';

// Redeeming a `/start` code is the only write this service makes, and it is where the
// link is decided: a code must work once, and a chat must not be taken over from
// another user. The pending rows the api mints are inserted directly here.

async function pendingLink(ttlMinutes = 15): Promise<{ userId: string; code: string }> {
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, name: 'Linker', email: `${userId}@example.test` });
  const code = randomUUID();
  await db.insert(userTelegramAccount).values({
    userId,
    linkCode: code,
    linkCodeExpiresAt: new Date(Date.now() + ttlMinutes * 60_000),
  });
  return { userId, code };
}

describe('confirmTelegramLink', () => {
  it('links the chat and refuses to replay the code', async () => {
    const { userId, code } = await pendingLink();
    const chatId = randomUUID();

    const first = await confirmTelegramLink({ code, chatId, username: 'lin', firstName: 'Lin' });
    expect(first).toEqual({ ok: true, userId });

    const replay = await confirmTelegramLink({ code, chatId, username: 'lin', firstName: 'Lin' });
    expect(replay).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses a chat already linked to another user', async () => {
    const chatId = randomUUID();
    const first = await pendingLink();
    await confirmTelegramLink({ code: first.code, chatId, username: null, firstName: null });

    const second = await pendingLink();
    const result = await confirmTelegramLink({
      code: second.code,
      chatId,
      username: null,
      firstName: null,
    });
    expect(result).toEqual({ ok: false, reason: 'taken' });
  });

  it('rejects an expired code', async () => {
    const { code } = await pendingLink(-1);
    const result = await confirmTelegramLink({
      code,
      chatId: randomUUID(),
      username: null,
      firstName: null,
    });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects an unknown code', async () => {
    const result = await confirmTelegramLink({
      code: 'nope',
      chatId: randomUUID(),
      username: null,
      firstName: null,
    });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });
});
