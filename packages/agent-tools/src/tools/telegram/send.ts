import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { jsonOrThrow } from '../../http';

// Sends a text message to a Telegram chat through a bot. The chat can be passed by
// the model or fall back to the credential's default chat.
export const telegramSend: CustomToolEntry = {
  key: 'telegram_send',
  label: 'Telegram Send Message',
  description: 'Send a text message to a Telegram chat through a bot.',
  inputSchema: z.object({
    chatId: z
      .string()
      .optional()
      .describe('Target chat id. Omit to use the configured default chat.'),
    text: z.string().min(1).describe('The message text to send.'),
  }),
  execute: async (credential, input) => {
    const chatId = input.chatId ? String(input.chatId) : String(credential.defaultChatId ?? '');
    if (!chatId) throw new Error('No chatId given and no default chat configured.');
    const res = await fetch(
      `https://api.telegram.org/bot${String(credential.botToken)}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: String(input.text) }),
      },
    );
    const data = (await jsonOrThrow(res, 'Telegram send')) as { result?: { message_id?: number } };
    return { sent: true, messageId: data.result?.message_id ?? null };
  },
};
