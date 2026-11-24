# bot

- Do not call the api or use an api credential. The bot connects only to Postgres and Telegram.
  The Helm chart passes it the shared configmap and secret, including `API_URL` and
  `BETTER_AUTH_SECRET`: the bot must not read them.
- Do not register a webhook for this bot: `bot.start()` calls `deleteWebhook` on every start.
