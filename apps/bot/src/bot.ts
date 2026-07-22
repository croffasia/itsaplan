import { Bot } from 'grammy';
import { confirmLink } from './api';

// The Telegram bot itself. Today it handles one thing: the `/start <code>` deep link
// that completes an account link. The code is minted by the api when the user presses
// "Connect" in their account settings, and the link opens this chat with it attached.

const HELP =
  'This bot delivers notifications from your project tracker.\n\n' +
  'To connect it, open Accounts in your profile and press Connect for Telegram.';

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command('start', async (ctx) => {
    // For /start, ctx.match is the deep-link payload — empty when the user opened the
    // bot directly instead of through the link.
    const code = ctx.match.trim();
    if (!code) {
      await ctx.reply(HELP);
      return;
    }
    const from = ctx.from;
    if (!from) return;
    // A link binds notifications to the chat it was confirmed in, so it is only
    // accepted in a private chat. Typed in a group, it would send one user's
    // notifications to everyone there.
    if (ctx.chat.type !== 'private') {
      await ctx.reply('Open a private chat with this bot to connect your account.');
      return;
    }

    const result = await confirmLink({
      code,
      chatId: String(ctx.chat.id),
      username: from.username ?? null,
      firstName: from.first_name ?? null,
    });

    if (result.ok) {
      await ctx.reply('Your Telegram account is connected. Notifications will arrive here.');
      return;
    }
    if (result.reason === 'taken') {
      await ctx.reply('This Telegram account is already connected to another user.');
      return;
    }
    await ctx.reply(
      'This link has expired. Open Accounts in your profile and press Connect again.',
    );
  });

  bot.on('message', async (ctx) => {
    await ctx.reply(HELP);
  });

  // An unhandled error would stop the polling loop, so every failure is logged and
  // swallowed instead. The user simply gets no reply, and can press Connect again.
  bot.catch((err) => {
    console.error('[bot] update failed:', err.error);
  });

  return bot;
}
