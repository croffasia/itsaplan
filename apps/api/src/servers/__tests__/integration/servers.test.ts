import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../../../app';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

const KEY =
  '-----BEGIN OPENSSH PRIVATE KEY-----\nnot-a-real-key\n-----END OPENSSH PRIVATE KEY-----';

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
  return { asOwner, owner };
}

function newServer(overrides: Record<string, unknown> = {}) {
  return {
    label: 'Web server',
    host: '10.0.0.5',
    username: 'root',
    authType: 'key' as const,
    secret: KEY,
    tags: ['production'],
    notes: 'Runs the shop.',
    ...overrides,
  };
}

describe('Servers', () => {
  beforeEach(async () => {
    await resetDb();
  }, 30_000);

  it('registers, lists, updates and removes a server', async () => {
    const { asOwner } = await setupProject();

    const created = await asOwner.projects({ projectKey: 'OPS' }).servers.post(newServer());
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      label: 'Web server',
      host: '10.0.0.5',
      port: 22,
      username: 'root',
      authType: 'key',
      active: true,
      hostKeyFingerprint: null,
    });

    const serverId = created.data!.id;

    const list = await asOwner.projects({ projectKey: 'OPS' }).servers.get();
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);

    const updated = await asOwner.servers({ serverId }).patch({ label: 'Shop server' });
    expect(updated.status).toBe(200);
    expect(updated.data).toMatchObject({ label: 'Shop server' });

    const removed = await asOwner.servers({ serverId }).delete();
    expect(removed.status).toBe(204);

    const after = await asOwner.projects({ projectKey: 'OPS' }).servers.get();
    expect(after.data).toHaveLength(0);
  });

  // The credential is the whole risk of this feature: it must never come back out.
  it('never returns the stored credential', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner
      .projects({ projectKey: 'OPS' })
      .servers.post(newServer({ authType: 'password', secret: 'super-secret-password' }));
    expect(JSON.stringify(created.data)).not.toContain('super-secret-password');

    const list = await asOwner.projects({ projectKey: 'OPS' }).servers.get();
    const raw = JSON.stringify(list.data);
    expect(raw).not.toContain('super-secret-password');
    expect(raw).not.toContain('credential');
    expect(raw).not.toContain('passphrase');
  });

  it('rejects a host that is not a hostname or an address', async () => {
    const { asOwner } = await setupProject();
    for (const host of ['10.0.0.5; rm -rf /', 'http://10.0.0.5', 'a b']) {
      const response = await asOwner
        .projects({ projectKey: 'OPS' })
        .servers.post(newServer({ host }));
      expect(response.status).toBe(400);
    }
  });

  it('rejects an out-of-range port and an empty credential', async () => {
    const { asOwner } = await setupProject();
    const badPort = await asOwner
      .projects({ projectKey: 'OPS' })
      .servers.post(newServer({ port: 70_000 }));
    expect(badPort.status).toBe(400);

    const noSecret = await asOwner
      .projects({ projectKey: 'OPS' })
      .servers.post(newServer({ secret: '   ' }));
    expect(noSecret.status).toBe(400);
  });

  it('refuses the same user on the same host twice', async () => {
    const { asOwner } = await setupProject();
    await asOwner.projects({ projectKey: 'OPS' }).servers.post(newServer());
    const duplicate = await asOwner.projects({ projectKey: 'OPS' }).servers.post(newServer());
    expect(duplicate.status).toBe(409);
  });

  // Re-pointing a server at another machine must not carry the old pin across.
  it('forgets the pinned host key when the target changes', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner.projects({ projectKey: 'OPS' }).servers.post(newServer());
    const serverId = created.data!.id;

    const moved = await asOwner.servers({ serverId }).patch({ host: '10.0.0.9' });
    expect(moved.data).toMatchObject({ host: '10.0.0.9', hostKeyFingerprint: null });

    const repinned = await asOwner.servers({ serverId }).repin.post();
    expect(repinned.status).toBe(200);
    expect(repinned.data).toMatchObject({ hostKeyFingerprint: null });
  });

  it('counts servers and unpinned hosts in the overview', async () => {
    const { asOwner } = await setupProject();
    await asOwner.projects({ projectKey: 'OPS' }).servers.post(newServer());
    const overview = await asOwner.projects({ projectKey: 'OPS' }).servers.overview.get();
    expect(overview.status).toBe(200);
    expect(overview.data).toMatchObject({ total: 1, active: 1, unpinned: 1, sessionsToday: 0 });
  });

  it('keeps a non-member out', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner.projects({ projectKey: 'OPS' }).servers.post(newServer());

    const outsider = await signUpTestUser();
    const asOutsider = authedApi(outsider.cookie);

    const list = await asOutsider.projects({ projectKey: 'OPS' }).servers.get();
    expect(list.status).toBe(403);

    const edit = await asOutsider.servers({ serverId: created.data!.id }).patch({ label: 'Mine' });
    expect(edit.status).toBe(403);
  });

  // Files and counters are as revealing as a shell, so they sit behind the same
  // access, and a non-member gets nothing.
  it('gates files and metrics behind terminal access', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner.projects({ projectKey: 'OPS' }).servers.post(newServer());
    const serverId = created.data!.id;

    const outsider = await signUpTestUser();
    const asOutsider = authedApi(outsider.cookie);

    const files = await asOutsider.servers({ serverId }).files.get({ query: {} });
    expect(files.status).toBe(403);
    const metrics = await asOutsider.servers({ serverId }).metrics.get();
    expect(metrics.status).toBe(403);
    const search = await asOutsider
      .servers({ serverId })
      .files.search.get({ query: { q: 'nginx' } });
    expect(search.status).toBe(403);
  });

  it('refuses a search term shorter than two characters', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner
      .projects({ projectKey: 'OPS' })
      .servers.post(newServer({ host: '127.0.0.1', port: 1 }));
    const serverId = created.data!.id;

    const short = await asOwner.servers({ serverId }).files.search.get({ query: { q: 'a' } });
    expect(short.status).toBe(400);
  });

  // The stored host is unreachable in the test, so this proves the failure is
  // reported as a bounded 502 rather than leaking the ssh2 message.
  it('reports an unreachable host without leaking detail', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner
      .projects({ projectKey: 'OPS' })
      .servers.post(newServer({ host: '127.0.0.1', port: 1 }));
    const serverId = created.data!.id;

    const files = await asOwner.servers({ serverId }).files.get({ query: { path: '/' } });
    expect(files.status).toBe(502);
    const raw = JSON.stringify(files.error?.value ?? {});
    expect(raw).not.toContain('ECONNREFUSED');
    expect(raw).not.toContain('127.0.0.1');
  });

  it('refuses a terminal socket without a session', async () => {
    const response = await app.handle(
      new Request('http://localhost/servers/1/terminal', {
        headers: { connection: 'Upgrade', upgrade: 'websocket' },
      }),
    );
    // Without a session authContext rejects the upgrade, so no socket is opened.
    expect(response.status).not.toBe(101);
    expect([400, 401, 426, 500]).toContain(response.status);
  });
});
