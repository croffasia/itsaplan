import type { Integration } from '../../types';
import { telegramSend } from './send';

// Telegram: a bot connection. One credential is one bot; two bots are two
// credentials.
export const telegram: Integration = {
  key: 'telegram',
  label: 'Telegram',
  credentialSchema: [
    {
      key: 'botToken',
      label: 'Bot token',
      type: 'secret',
      required: true,
      placeholder: '123456:ABC-DEF...',
      help: 'The token from @BotFather.',
    },
    {
      key: 'defaultChatId',
      label: 'Default chat id',
      type: 'string',
      required: false,
      help: 'Used when the agent does not pass a chatId.',
    },
  ],
  tools: [telegramSend],
};
