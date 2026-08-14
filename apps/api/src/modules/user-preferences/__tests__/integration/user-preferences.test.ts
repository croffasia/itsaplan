import { describe, it, expect, beforeEach } from 'bun:test';
import { api, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Account preferences are self-scoped: a user only ever reads and writes their own
// row, so there is no project or permission wiring to cover. A read before any write
// returns the defaults instead of failing, and a patch leaves omitted fields alone.

describe('user preferences', () => {
  beforeEach(resetDb);

  it('returns the defaults when nothing was saved', async () => {
    const u = await signUpTestUser();

    const res = await authedApi(u.cookie).account.preferences.get();

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      timezone: 'UTC',
      locale: 'en',
      theme: 'system',
      issueOpenMode: 'panel',
      startPage: 'work-items',
      showChatByDefault: false,
      issueStatsOpen: true,
      issueStatsView: 'compact',
      issueActivityView: 'flat',
      autoWatch: true,
      lastProjectId: null,
      hotkeys: {},
    });
  });

  it('uses the preferred supported browser language when nothing was saved', async () => {
    const u = await signUpTestUser();

    const res = await authedApi(u.cookie, {
      'accept-language': 'ru;q=0.4,zh-CN;q=0.9,en;q=0.8',
    }).account.preferences.get();

    expect(res.status).toBe(200);
    expect(res.data?.locale).toBe('zh-CN');
  });

  it('saves the preferred browser language with the first preference update', async () => {
    const u = await signUpTestUser();
    const client = authedApi(u.cookie, {
      'accept-language': 'uk-UA,uk;q=0.9,en;q=0.8',
    });

    await client.account.preferences.patch({ theme: 'dark' });

    const stored = await authedApi(u.cookie, { 'accept-language': 'en' }).account.preferences.get();
    expect(stored.data).toMatchObject({ locale: 'uk', theme: 'dark' });
  });

  it('saves a full update and reads it back', async () => {
    const u = await signUpTestUser();
    const client = authedApi(u.cookie);

    const res = await client.account.preferences.patch({
      timezone: 'Europe/Berlin',
      locale: 'uk',
      theme: 'dark',
      issueOpenMode: 'page',
      startPage: 'inbox',
      showChatByDefault: true,
      issueStatsOpen: false,
      issueStatsView: 'timeline',
      issueActivityView: 'grouped',
      autoWatch: false,
      hotkeys: { 'issue.new': 'i' },
    });

    expect(res.status).toBe(200);
    const stored = await client.account.preferences.get();
    expect(stored.data).toEqual({
      timezone: 'Europe/Berlin',
      locale: 'uk',
      theme: 'dark',
      issueOpenMode: 'page',
      startPage: 'inbox',
      showChatByDefault: true,
      issueStatsOpen: false,
      issueStatsView: 'timeline',
      issueActivityView: 'grouped',
      autoWatch: false,
      lastProjectId: null,
      hotkeys: { 'issue.new': 'i' },
    });
  });

  it('keeps the fields left out of a patch', async () => {
    const u = await signUpTestUser();
    const client = authedApi(u.cookie);
    await client.account.preferences.patch({ timezone: 'Europe/Berlin', theme: 'dark' });

    const res = await client.account.preferences.patch({ theme: 'light' });

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ timezone: 'Europe/Berlin', theme: 'light' });
  });

  it('rejects an unknown timezone', async () => {
    const u = await signUpTestUser();

    const res = await authedApi(u.cookie).account.preferences.patch({ timezone: 'Mars/Olympus' });

    expect(res.status).toBe(400);
  });

  it('rejects a value outside the allowed set', async () => {
    const u = await signUpTestUser();

    const res = await authedApi(u.cookie).account.preferences.patch({
      theme: 'sepia' as 'dark',
    });

    expect(res.status).toBe(400);
  });

  it('rejects an unsupported locale', async () => {
    const u = await signUpTestUser();

    const res = await authedApi(u.cookie).account.preferences.patch({
      locale: 'de' as 'uk',
    });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown issue stats view', async () => {
    const u = await signUpTestUser();

    const res = await authedApi(u.cookie).account.preferences.patch({
      issueStatsView: 'lanes' as 'timeline',
    });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown issue activity view', async () => {
    const u = await signUpTestUser();

    const res = await authedApi(u.cookie).account.preferences.patch({
      issueActivityView: 'stacked' as 'grouped',
    });

    expect(res.status).toBe(400);
  });

  it('keeps each user on their own preferences', async () => {
    const first = await signUpTestUser();
    const second = await signUpTestUser();
    await authedApi(first.cookie).account.preferences.patch({ theme: 'dark' });

    const res = await authedApi(second.cookie).account.preferences.get();

    expect(res.data).toMatchObject({ theme: 'system' });
  });

  it('remembers a project the user belongs to', async () => {
    const u = await signUpTestUser();
    const client = authedApi(u.cookie);
    const created = await client.projects.post({ key: 'MKT', name: 'Marketing' });
    const projectId = created.data!.id;

    const res = await client.account.preferences.patch({ lastProjectId: projectId });

    expect(res.status).toBe(200);
    const stored = await client.account.preferences.get();
    expect(stored.data).toMatchObject({ lastProjectId: projectId });
  });

  it('rejects a project the user is not a member of', async () => {
    const owner = await signUpTestUser();
    const outsider = await signUpTestUser();
    const created = await authedApi(owner.cookie).projects.post({ key: 'MKT', name: 'Marketing' });

    const res = await authedApi(outsider.cookie).account.preferences.patch({
      lastProjectId: created.data!.id,
    });

    expect(res.status).toBe(403);
  });

  it('rejects a request without a session', async () => {
    const res = await api.account.preferences.get();

    expect(res.status).toBe(401);
  });
});
