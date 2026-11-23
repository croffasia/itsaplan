import type { ToolConfig } from '../../types';

// Slack Web API client for a bot token. Slack reports most failures as `ok: false`
// with an error code in the body, so the code is read off the body and turned into a
// message a person can act on: a tool error goes straight to the model.

const API = 'https://slack.com/api';

export interface SlackResponse {
  ok?: boolean;
  error?: string;
  // The scope a missing_scope answer asks for.
  needed?: string;
  response_metadata?: { next_cursor?: string };
  [key: string]: unknown;
}

export class SlackApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'SlackApiError';
  }
}

const HINTS: Record<string, string> = {
  not_in_channel: 'Invite the bot to the channel first: /invite @the-bot in Slack.',
  channel_not_found:
    'Check the channel id. A private channel is visible only once the bot is in it.',
  users_not_found: 'No active member of the workspace has this email.',
  invalid_auth: 'The bot token is not valid. Update the credential.',
  token_revoked: 'The bot token was revoked. Update the credential.',
  account_inactive:
    'The app was removed from the workspace. Reinstall it and update the credential.',
};

// Calls a Web API method. A write is posted as JSON; a read goes as GET with the
// arguments in the query string, because conversations.list, conversations.replies and
// users.lookupByEmail take no JSON body.
export async function slackCall(
  credential: ToolConfig,
  method: string,
  args: Record<string, unknown>,
  { post = false }: { post?: boolean } = {},
): Promise<SlackResponse> {
  const authorization = `Bearer ${String(credential.botToken ?? '')}`;
  let res: Response;
  if (post) {
    res = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(args),
    });
  } else {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    res = await fetch(`${API}/${method}?${query}`, { headers: { authorization } });
  }
  if (res.status === 429) {
    const wait = res.headers.get('retry-after');
    throw new SlackApiError(
      `Slack ${method} is rate limited.${wait ? ` Retry after ${wait} seconds.` : ''}`,
      'ratelimited',
    );
  }
  if (!res.ok)
    throw new SlackApiError(`Slack ${method} failed (HTTP ${res.status}).`, 'http_error');
  const body = (await res.json()) as SlackResponse;
  if (body.ok) return body;
  const code = body.error ?? 'unknown_error';
  const hint =
    code === 'missing_scope' && body.needed
      ? `Add the ${body.needed} scope to the app and reinstall it to the workspace.`
      : HINTS[code];
  throw new SlackApiError(`Slack ${method} failed: ${code}.${hint ? ` ${hint}` : ''}`, code);
}

interface SlackMessage {
  ts?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
}

// A message as the model reads it. A message in a thread carries the thread's ts, and
// a thread's parent carries how many replies it has.
function toMessage(m: SlackMessage) {
  return {
    ts: m.ts,
    user: m.user ?? null,
    botId: m.bot_id ?? null,
    text: m.text ?? '',
    threadTs: m.thread_ts ?? null,
    replyCount: m.reply_count ?? 0,
  };
}

export function messagesOf(body: SlackResponse) {
  return {
    messages: ((body.messages as SlackMessage[] | undefined) ?? []).map(toMessage),
    hasMore: Boolean(body.has_more),
    nextCursor: body.response_metadata?.next_cursor || null,
  };
}
