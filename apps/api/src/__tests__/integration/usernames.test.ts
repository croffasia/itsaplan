import { describe, it, expect, beforeEach } from 'bun:test';
import { auth } from '@repo/auth';
import { authedApi } from '../helpers/app';
import { signUpTestUser } from '../helpers/auth';
import { resetDb } from '../helpers/db';

const PASSWORD = 'test-password-123';

async function usernameOf(cookie: string): Promise<string | null> {
  const session = await auth.api.getSession({ headers: { cookie } });
  return session?.user.username ?? null;
}

// A project with one agent answering to the given handle, so the account paths can be
// checked against a name an agent already holds.
async function projectWithAgent(handle: string): Promise<void> {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  await asOwner.projects({ projectKey: 'MKT' })['ai-agents'].post({
    name: 'Design Bot',
    username: handle,
    kind: 'external',
  });
}

// Sign-up never asks for a username: @repo/auth derives one from the address, and
// the sign-in screen sends whatever was typed to /sign-in/email or
// /sign-in/username. This covers both halves.
describe('usernames', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('derives the username from the local part of the address', async () => {
    const created = await signUpTestUser({ email: 'jane.doe@example.com' });

    expect(await usernameOf(created.cookie)).toBe('jane.doe');
  });

  it('gives the same local part on another domain a distinct username', async () => {
    const first = await signUpTestUser({ email: 'jane.doe@example.com' });
    const second = await signUpTestUser({ email: 'jane.doe@other.com' });

    const taken = await usernameOf(first.cookie);
    const derived = await usernameOf(second.cookie);
    expect(taken).toBe('jane.doe');
    expect(derived).toMatch(/^jane\.doe\d{3}$/);
  });

  it('signs in with the username and the password', async () => {
    const created = await signUpTestUser({ email: 'jane.doe@example.com', password: PASSWORD });

    const response = await auth.api.signInUsername({
      body: { username: 'jane.doe', password: PASSWORD },
      asResponse: true,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { user?: { id?: string } };
    expect(body.user?.id).toBe(created.userId);
  });

  it('refuses a username another account already has', async () => {
    await signUpTestUser({ email: 'jane.doe@example.com' });
    const other = await signUpTestUser({ email: 'someone@example.com' });

    const attempt = auth.api.updateUser({
      body: { username: 'jane.doe' },
      headers: { cookie: other.cookie },
    });

    await expect(attempt).rejects.toThrow('Username is already taken. Please try another.');
    expect(await usernameOf(other.cookie)).toBe('someone');
  });

  it('changes the username of the signed-in account', async () => {
    const created = await signUpTestUser({ email: 'jane.doe@example.com' });

    const response = await auth.api.updateUser({
      body: { username: 'janed' },
      headers: { cookie: created.cookie },
      asResponse: true,
    });

    expect(response.status).toBe(200);
    expect(await usernameOf(created.cookie)).toBe('janed');
  });

  // A mention is resolved against members and agents at once, so the two share one
  // namespace and every path that sets an account's name checks it against the agents.
  it('refuses a sign-up carrying a username an agent uses', async () => {
    await projectWithAgent('design');

    const attempt = auth.api.signUpEmail({
      body: {
        email: 'impostor@example.com',
        password: PASSWORD,
        name: 'Impostor',
        username: 'design',
      },
    });

    await expect(attempt).rejects.toThrow('Username is already taken. Please try another.');
  });

  it('refuses changing a username onto one an agent uses', async () => {
    await projectWithAgent('design');
    const member = await signUpTestUser({ email: 'someone@example.com' });

    const attempt = auth.api.updateUser({
      body: { username: 'design' },
      headers: { cookie: member.cookie },
    });

    await expect(attempt).rejects.toThrow('Username is already taken. Please try another.');
    expect(await usernameOf(member.cookie)).toBe('someone');
  });

  it('derives a username that skips a name an agent uses', async () => {
    await projectWithAgent('jane.doe');

    const created = await signUpTestUser({ email: 'jane.doe@example.com' });

    expect(await usernameOf(created.cookie)).toMatch(/^jane\.doe\d{3}$/);
  });

  it('does not answer whether a username is taken', async () => {
    await signUpTestUser({ email: 'jane.doe@example.com' });

    const response = await auth.handler(
      new Request('http://localhost/api/auth/is-username-available', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'jane.doe' }),
      }),
    );

    expect(response.status).toBe(404);
  });
});
