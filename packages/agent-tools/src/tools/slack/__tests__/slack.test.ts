import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import { getTool } from '../../../registry';
import { slackSendMessage } from '../send-message';
import { slackListChannels } from '../list-channels';
import { slackGetThread } from '../get-thread';
import { slackAddReaction } from '../add-reaction';
import { verifySlack } from '../verify';

const fetchSpy = spyOn(globalThis, 'fetch');
const credential = { botToken: 'xoxb-test', defaultChannel: 'C0DEFAULT' };

function respond(body: unknown, init: ResponseInit = {}) {
  fetchSpy.mockResolvedValue(Response.json(body, init));
}

function lastCall() {
  const [url, init] = fetchSpy.mock.calls.at(-1)!;
  return { url: String(url), init: init as RequestInit & { headers: Record<string, string> } };
}

describe('slack', () => {
  afterEach(() => fetchSpy.mockClear());
  afterAll(() => fetchSpy.mockRestore());

  it('is registered with a bot token', () => {
    const integration = getTool('slack_send_message')?.integration;
    expect(integration?.key).toBe('slack');
    expect(integration?.credentialSchema.find((f) => f.key === 'botToken')?.type).toBe('secret');
  });

  it('posts to the default channel as JSON with the token in the header', async () => {
    respond({ ok: true, channel: 'C0DEFAULT', ts: '1700000000.000100' });
    const result = await slackSendMessage.execute(credential, { text: '*Done*' });

    const { url, init } = lastCall();
    expect(url).toBe('https://slack.com/api/chat.postMessage');
    expect(init.headers.authorization).toBe('Bearer xoxb-test');
    expect(JSON.parse(String(init.body))).toEqual({ channel: 'C0DEFAULT', text: '*Done*' });
    expect(result).toEqual({ sent: true, channel: 'C0DEFAULT', ts: '1700000000.000100' });
  });

  it('replies in a thread of the channel it is given', async () => {
    respond({ ok: true, channel: 'C1', ts: '2.0' });
    await slackSendMessage.execute(credential, { channel: 'C1', text: 'ok', threadTs: '1.0' });
    expect(JSON.parse(String(lastCall().init.body))).toEqual({
      channel: 'C1',
      text: 'ok',
      thread_ts: '1.0',
    });
  });

  it('refuses to send with no channel at all', async () => {
    await expect(
      slackSendMessage.execute({ botToken: 'xoxb-test' }, { text: 'hi' }),
    ).rejects.toThrow('No channel given');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reads with the arguments in the query string and maps the page', async () => {
    respond({
      ok: true,
      channels: [{ id: 'C1', name: 'general', is_private: false, is_member: true, num_members: 4 }],
      response_metadata: { next_cursor: 'next' },
    });
    const result = await slackListChannels.execute(credential, { includePrivate: true });

    const { url, init } = lastCall();
    expect(url).toBe(
      'https://slack.com/api/conversations.list?types=public_channel%2Cprivate_channel&exclude_archived=true&limit=100',
    );
    expect(init.method).toBeUndefined();
    expect(result).toEqual({
      channels: [
        { id: 'C1', name: 'general', isPrivate: false, isMember: true, members: 4, topic: null },
      ],
      nextCursor: 'next',
    });
  });

  it('maps the messages of a thread', async () => {
    respond({
      ok: true,
      messages: [{ ts: '1.0', user: 'U1', text: 'Start', thread_ts: '1.0', reply_count: 1 }],
      has_more: false,
    });
    const result = await slackGetThread.execute(credential, { channel: 'C1', ts: '1.0' });
    expect(result).toEqual({
      messages: [
        { ts: '1.0', user: 'U1', botId: null, text: 'Start', threadTs: '1.0', replyCount: 1 },
      ],
      hasMore: false,
      nextCursor: null,
    });
  });

  it('turns an error code into what to do about it', async () => {
    respond({ ok: false, error: 'not_in_channel' });
    await expect(slackSendMessage.execute(credential, { text: 'hi' })).rejects.toThrow(
      'Slack chat.postMessage failed: not_in_channel. Invite the bot to the channel first',
    );
    respond({ ok: false, error: 'missing_scope', needed: 'reactions:write' });
    await expect(
      slackAddReaction.execute(credential, { channel: 'C1', ts: '1.0', emoji: 'eyes' }),
    ).rejects.toThrow('Add the reactions:write scope');
  });

  it('says how long to wait when rate limited', async () => {
    respond({}, { status: 429, headers: { 'retry-after': '30' } });
    await expect(slackSendMessage.execute(credential, { text: 'hi' })).rejects.toThrow(
      'Retry after 30 seconds',
    );
  });

  it('counts a reaction that is already there as added, without colons', async () => {
    respond({ ok: false, error: 'already_reacted' });
    const result = await slackAddReaction.execute(credential, {
      channel: 'C1',
      ts: '1.0',
      emoji: ':eyes:',
    });
    expect(JSON.parse(String(lastCall().init.body)).name).toBe('eyes');
    expect(result).toEqual({ added: true });
  });

  it('verifies a token with auth.test', async () => {
    const signal = new AbortController().signal;
    respond({ ok: true, team_id: 'T1' });
    expect(await verifySlack(credential, signal)).toBe('valid');
    respond({ ok: false, error: 'invalid_auth' });
    expect(await verifySlack(credential, signal)).toBe('rejected');
    respond({ ok: false, error: 'internal_error' });
    expect(await verifySlack(credential, signal)).toBe('unavailable');
    respond({}, { status: 503 });
    expect(await verifySlack(credential, signal)).toBe('unavailable');
  });
});
