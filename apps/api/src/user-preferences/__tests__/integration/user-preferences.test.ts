import { describe, it, expect, beforeEach } from 'bun:test';
import { api, authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

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
      theme: 'system',
      issueOpenMode: 'panel',
      startPage: 'work-items',
      showChatByDefault: false,
      lastProjectId: null,
      hotkeys: {},
    });
  });

  it('saves a full update and reads it back', async () => {
    const u = await signUpTestUser();
    const client = authedApi(u.cookie);

    const res = await client.account.preferences.patch({
      timezone: 'Europe/Berlin',
      theme: 'dark',
      issueOpenMode: 'page',
      startPage: 'inbox',
      showChatByDefault: true,
      hotkeys: { 'issue.new': 'i' },
    });

    expect(res.status).toBe(200);
    const stored = await client.account.preferences.get();
    expect(stored.data).toEqual({
      timezone: 'Europe/Berlin',
      theme: 'dark',
      issueOpenMode: 'page',
      startPage: 'inbox',
      showChatByDefault: true,
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
