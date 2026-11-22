import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, slackLinkRequest } from '@repo/db';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The instance app is set up in god mode, a workspace may send through its own, and a
// member connects their Slack account with Sign in with Slack through the app that
// serves the project. Slack is answered by a stub: auth.test names the workspace a bot
// token belongs to, and openid.connect.token answers a code with an id token.

const realFetch = globalThis.fetch;
const app = { botToken: 'xoxb-instance', clientId: '1.2', clientSecret: 'secret' };

interface Claims {
  aud?: string;
  nonce?: string;
  name?: string;
  'https://slack.com/user_id'?: string;
  'https://slack.com/team_id'?: string;
}

let slack: {
  // The answer of auth.test for each bot token.
  bots: Record<string, Record<string, unknown>>;
  // The id token claims for each code; the nonce is filled from the request.
  codes: Record<string, (nonce: string) => Claims>;
  asked: string[];
};
// The nonce of the last authorize address handed out, which Slack puts in the id token.
let nonce = '';

function idToken(claims: Claims): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(claims)}.signature`;
}

beforeEach(async () => {
  await resetDb();
  slack = {
    bots: {
      'xoxb-instance': { ok: true, bot_id: 'B1', team_id: 'T1', team: 'Acme' },
      'xoxb-own': { ok: true, bot_id: 'B2', team_id: 'T2', team: 'Acme Labs' },
    },
    codes: {},
    asked: [],
  };
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('https://slack.com/api/')) return realFetch(input, init);
    const method = url.slice('https://slack.com/api/'.length);
    slack.asked.push(method);
    if (method === 'auth.test') {
      const token = new Headers(init?.headers).get('authorization')!.slice('Bearer '.length);
      return Response.json(slack.bots[token] ?? { ok: false, error: 'invalid_auth' });
    }
    const form = init?.body as URLSearchParams;
    const claims = slack.codes[form.get('code')!];
    if (!claims) return Response.json({ ok: false, error: 'invalid_code' });
    return Response.json({ ok: true, access_token: 'xoxp-1', id_token: idToken(claims(nonce)) });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

async function setup() {
  const god = await signUpTestUser();
  const api = authedApi(god.cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  const workspaces = await api.workspaces.get();
  const workspaceId = workspaces.data!.find((w) => w.role === 'owner')!.id;
  return { api, workspaceId };
}

const instance = (api: Api) => api.god['slack-settings'];
const account = (api: Api) => api.projects({ projectKey: 'MKT' }).slack.account;

async function startLink(api: Api): Promise<URL> {
  const res = await account(api).link.post();
  expect(res.status).toBe(200);
  const url = new URL(res.data!.url);
  nonce = url.searchParams.get('nonce')!;
  return url;
}

describe('slack', () => {
  describe('instance app', () => {
    it('is refused while a part of it is missing, or for a token that is not a bot', async () => {
      const { api } = await setup();

      expect((await instance(api).put({ enabled: true, botToken: 'xoxb-instance' })).status).toBe(
        400,
      );
      const person = await instance(api).put({ ...app, botToken: 'xoxp-person' });
      expect(person.status).toBe(400);
      expect(person.error?.value).toMatchObject({
        error: 'Slack does not accept this bot token. Copy the Bot User OAuth Token again',
      });

      expect((await instance(api).get()).data).toMatchObject({
        enabled: false,
        hasBotToken: false,
      });
    });

    it('names the Slack workspace of the token and asks Slack only when the token changes', async () => {
      const { api } = await setup();

      const saved = await instance(api).put({ enabled: true, ...app });
      await instance(api).put({ enabled: true, clientId: '1.3' });

      expect(saved.data).toEqual({
        enabled: true,
        hasBotToken: true,
        clientId: '1.2',
        hasClientSecret: true,
        slackTeamName: 'Acme',
        redirectUrl: `${process.env.APP_URL}/slack/connect`,
      });
      expect((await instance(api).get()).data!.clientId).toBe('1.3');
      expect(slack.asked).toEqual(['auth.test']);
    });

    it('is not reachable for someone who is not god', async () => {
      await setup();
      const other = authedApi((await signUpTestUser()).cookie);

      expect((await instance(other).get()).status).toBe(403);
    });
  });

  describe('workspace app', () => {
    it('sends through the instance app until the owner sets one of its own', async () => {
      const { api, workspaceId } = await setup();
      await instance(api).put({ enabled: true, ...app });
      const settings = api.workspaces({ workspaceId })['slack-settings'];

      expect((await settings.get()).data).toMatchObject({
        enabled: true,
        own: false,
        instanceSlackTeamName: 'Acme',
      });
      expect((await account(api).get()).data!.slackTeamName).toBe('Acme');

      expect((await settings.put({ enabled: true, own: true })).status).toBe(400);
      const own = await settings.put({ enabled: true, own: true, ...app, botToken: 'xoxb-own' });
      expect(own.data).toMatchObject({ own: true, slackTeamName: 'Acme Labs' });
      expect((await account(api).get()).data!.slackTeamName).toBe('Acme Labs');

      await settings.put({ enabled: false, own: true });
      expect((await account(api).get()).data).toEqual({ slackTeamName: null, link: null });
      expect((await account(api).link.post()).status).toBe(400);
    });

    it('is the owner’s alone', async () => {
      const { workspaceId } = await setup();
      const other = authedApi((await signUpTestUser()).cookie);

      const res = await other.workspaces({ workspaceId })['slack-settings'].get();

      expect(res.status).toBe(404);
    });
  });

  describe('account', () => {
    it('connects the account Slack confirms and returns to the project', async () => {
      const { api } = await setup();
      await instance(api).put({ enabled: true, ...app });

      const url = await startLink(api);
      expect(url.origin + url.pathname).toBe('https://slack.com/openid/connect/authorize');
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        response_type: 'code',
        scope: 'openid profile',
        client_id: '1.2',
        team: 'T1',
        redirect_uri: `${process.env.APP_URL}/slack/connect`,
      });
      slack.codes.ok = (nonce) => ({
        aud: '1.2',
        nonce,
        name: 'Ann',
        'https://slack.com/user_id': 'U1',
        'https://slack.com/team_id': 'T1',
      });

      const done = await api.slack.account.complete.post({
        code: 'ok',
        state: url.searchParams.get('state')!,
      });

      expect(done.status).toBe(200);
      expect(done.data!.projectRef).toEndWith('.MKT');
      expect((await account(api).get()).data).toMatchObject({
        slackTeamName: 'Acme',
        link: { name: 'Ann' },
      });

      await account(api).delete();
      expect((await account(api).get()).data!.link).toBeNull();
    });

    it('is refused to someone who is not a member of the project', async () => {
      const { api } = await setup();
      await instance(api).put({ enabled: true, ...app });
      const other = authedApi((await signUpTestUser()).cookie);

      expect((await account(other).get()).status).toBe(403);
      expect((await account(other).link.post()).status).toBe(403);
      expect((await account(other).delete()).status).toBe(403);
    });

    it('refuses a connection completed after it expired', async () => {
      const { api } = await setup();
      await instance(api).put({ enabled: true, ...app });
      const state = (await startLink(api)).searchParams.get('state')!;
      // An expired request cannot be produced through the API without waiting 15 minutes.
      await db.update(slackLinkRequest).set({ expiresAt: new Date(Date.now() - 1000) });

      const res = await api.slack.account.complete.post({ code: 'ok', state });

      expect(res.status).toBe(400);
      expect(slack.asked).not.toContain('openid.connect.token');
    });

    it('refuses a state started by someone else, used twice, or for another Slack workspace', async () => {
      const { api } = await setup();
      await instance(api).put({ enabled: true, ...app });
      const url = await startLink(api);
      const state = url.searchParams.get('state')!;
      slack.codes.other = (nonce) => ({
        aud: '1.2',
        nonce,
        'https://slack.com/user_id': 'U9',
        'https://slack.com/team_id': 'T9',
      });
      const stranger = authedApi((await signUpTestUser()).cookie);

      expect((await stranger.slack.account.complete.post({ code: 'other', state })).status).toBe(
        404,
      );
      const elsewhere = await api.slack.account.complete.post({ code: 'other', state });
      expect(elsewhere.status).toBe(400);
      expect(elsewhere.error?.value).toMatchObject({
        error: 'Sign in to the Acme Slack workspace, then connect again',
      });
      expect((await api.slack.account.complete.post({ code: 'other', state })).status).toBe(404);
    });

    it('moves a Slack account to the account that connects it again', async () => {
      const { api } = await setup();
      await instance(api).put({ enabled: true, ...app });
      const member = await signUpTestUser();
      const memberApi = authedApi(member.cookie);
      const invite = await api
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: member.email, role: 'member' });
      await memberApi.invites({ token: invite.data!.token }).accept.post();
      slack.codes.same = (nonce) => ({
        aud: '1.2',
        nonce,
        'https://slack.com/user_id': 'U1',
        'https://slack.com/team_id': 'T1',
      });

      const first = await startLink(api);
      await api.slack.account.complete.post({
        code: 'same',
        state: first.searchParams.get('state')!,
      });
      const second = await startLink(memberApi);
      const res = await memberApi.slack.account.complete.post({
        code: 'same',
        state: second.searchParams.get('state')!,
      });

      expect(res.status).toBe(200);
      expect((await account(memberApi).get()).data!.link).not.toBeNull();
      expect((await account(api).get()).data!.link).toBeNull();
    });
  });
});
