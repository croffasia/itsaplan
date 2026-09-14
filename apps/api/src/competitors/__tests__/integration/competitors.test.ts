import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

describe('Competitors', () => {
  beforeEach(resetDb);

  it('tracks, lists, updates and untracks an account', async () => {
    const { asOwner } = await setupProject();

    const created = await asOwner.projects({ projectKey: 'MKT' }).competitors.post({
      platform: 'instagram',
      handle: '@RivalBrand',
      label: 'Their main account',
      tags: ['direct-rival'],
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      platform: 'instagram',
      // Stored bare and lowercased.
      handle: 'rivalbrand',
      label: 'Their main account',
      tags: ['direct-rival'],
      active: true,
      latest: null,
      consecutiveFailures: 0,
    });

    const competitorId = created.data!.id;

    const list = await asOwner.projects({ projectKey: 'MKT' }).competitors.get();
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);

    const paused = await asOwner.competitors({ competitorId }).patch({ active: false });
    expect(paused.data).toMatchObject({ active: false });

    const removed = await asOwner.competitors({ competitorId }).delete();
    expect(removed.status).toBe(204);

    const after = await asOwner.projects({ projectKey: 'MKT' }).competitors.get();
    expect(after.data).toHaveLength(0);
  });

  it('normalises a pasted profile url to the same handle', async () => {
    const { asOwner } = await setupProject();
    const competitors = asOwner.projects({ projectKey: 'MKT' }).competitors;

    const fromUrl = await competitors.post({
      platform: 'tiktok',
      handle: 'https://www.tiktok.com/@RivalBrand?lang=nl',
    });
    expect(fromUrl.data).toMatchObject({ handle: 'rivalbrand' });

    // The same account under a different spelling is a duplicate, not a second row.
    const duplicate = await competitors.post({ platform: 'tiktok', handle: '@rivalbrand' });
    expect(duplicate.status).toBe(409);
  });

  it('allows the same handle on two platforms', async () => {
    const { asOwner } = await setupProject();
    const competitors = asOwner.projects({ projectKey: 'MKT' }).competitors;
    const first = await competitors.post({ platform: 'instagram', handle: 'rivalbrand' });
    const second = await competitors.post({ platform: 'facebook', handle: 'rivalbrand' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it('rejects an unknown platform and a handle that is not one', async () => {
    const { asOwner } = await setupProject();
    const competitors = asOwner.projects({ projectKey: 'MKT' }).competitors;

    // @ts-expect-error only the three platforms are accepted
    const badPlatform = await competitors.post({ platform: 'linkedin', handle: 'rival' });
    expect(badPlatform.status).toBe(400);

    const blank = await competitors.post({ platform: 'instagram', handle: '   ' });
    expect(blank.status).toBe(400);

    const notAHandle = await competitors.post({
      platform: 'instagram',
      handle: 'not a handle!',
    });
    expect(notAHandle.status).toBe(400);
  });

  it('reports what the project can read in the overview', async () => {
    const { asOwner } = await setupProject();
    await asOwner
      .projects({ projectKey: 'MKT' })
      .competitors.post({ platform: 'instagram', handle: 'rivalbrand' });

    const overview = await asOwner.projects({ projectKey: 'MKT' }).competitors.overview.get();
    expect(overview.status).toBe(200);
    expect(overview.data).toMatchObject({ tracked: 1, active: 1, alertsToday: 0, unread: 0 });
    // No credentials are configured in a fresh project, so nothing is readable yet.
    expect(overview.data!.providers).toHaveLength(3);
    expect(overview.data!.providers.every((provider) => !provider.available)).toBe(true);
  });

  it('records why a check failed instead of throwing', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .competitors.post({ platform: 'instagram', handle: 'rivalbrand' });

    // No Instagram credential exists, so the provider cannot read the account.
    const checked = await asOwner.competitors({ competitorId: created.data!.id }).check.post();
    expect(checked.status).toBe(200);
    expect(checked.data).toMatchObject({ ok: false, events: 0 });
    expect(checked.data!.error).toContain('Instagram credential');
    expect(checked.data!.competitor).toMatchObject({ consecutiveFailures: 1 });
    expect(checked.data!.competitor.lastError).toContain('Instagram credential');
  });

  it('starts with an empty alert feed and can mark it read', async () => {
    const { asOwner } = await setupProject();
    const events = await asOwner
      .projects({ projectKey: 'MKT' })
      .competitors.events.get({ query: {} });
    expect(events.status).toBe(200);
    expect(events.data).toEqual([]);

    const marked = await asOwner.projects({ projectKey: 'MKT' }).competitors.events.read.post();
    expect(marked.data).toMatchObject({ marked: 0 });
  });

  it('keeps a non-member out', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .competitors.post({ platform: 'instagram', handle: 'rivalbrand' });

    const outsider = await signUpTestUser();
    const asOutsider = authedApi(outsider.cookie);

    const list = await asOutsider.projects({ projectKey: 'MKT' }).competitors.get();
    expect(list.status).toBe(403);

    const edited = await asOutsider
      .competitors({ competitorId: created.data!.id })
      .patch({ active: false });
    expect(edited.status).toBe(403);

    const checked = await asOutsider.competitors({ competitorId: created.data!.id }).check.post();
    expect(checked.status).toBe(403);
  });

  it('404s on an account that does not exist', async () => {
    const { asOwner } = await setupProject();
    const missing = await asOwner.competitors({ competitorId: 999_999 }).patch({ active: false });
    expect(missing.status).toBe(404);
  });

  it('refuses an internal sweep without the worker token', async () => {
    const { asOwner } = await setupProject();
    const sweep = await asOwner.internal.competitors.sweep.post({
      intervalMs: 3_600_000,
      batchSize: 5,
    });
    expect(sweep.status).toBe(401);
  });
});
