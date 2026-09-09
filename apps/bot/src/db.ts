import { and, eq, gt, ne } from 'drizzle-orm';
import { db, userTelegramAccount } from '@repo/db';

// The account links the bot redeems. The instance bot settings it polls are read
// through @repo/db, which the api writes them with.

export interface ConfirmLinkInput {
  code: string;
  chatId: string;
  username: string | null;
  firstName: string | null;
}

export type ConfirmLinkResult =
  { ok: true; userId: string } | { ok: false; reason: 'invalid' | 'taken' };

// Completes a link: matches the code the api minted, then writes the chat id onto that
// user's row and clears the code so it cannot be replayed. 'invalid' covers an
// unknown, already-used, or expired code — the user is told to start again either
// way. 'taken' means this Telegram account is already linked to someone else.
export async function confirmTelegramLink(input: ConfirmLinkInput): Promise<ConfirmLinkResult> {
  const rows = await db
    .select({ userId: userTelegramAccount.userId })
    .from(userTelegramAccount)
    .where(
      and(
        eq(userTelegramAccount.linkCode, input.code),
        gt(userTelegramAccount.linkCodeExpiresAt, new Date()),
      ),
    );
  const pending = rows[0];
  if (!pending) return { ok: false, reason: 'invalid' };

  const conflict = await db
    .select({ userId: userTelegramAccount.userId })
    .from(userTelegramAccount)
    .where(
      and(
        eq(userTelegramAccount.chatId, input.chatId),
        ne(userTelegramAccount.userId, pending.userId),
      ),
    );
  if (conflict.length > 0) return { ok: false, reason: 'taken' };

  await db
    .update(userTelegramAccount)
    .set({
      chatId: input.chatId,
      username: input.username,
      firstName: input.firstName,
      linkedAt: new Date(),
      linkCode: null,
      linkCodeExpiresAt: null,
    })
    .where(eq(userTelegramAccount.userId, pending.userId));
  return { ok: true, userId: pending.userId };
}
