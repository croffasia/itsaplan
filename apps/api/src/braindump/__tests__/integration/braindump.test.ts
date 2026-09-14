import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// The vault destination writes to OBSIDIAN_VAULT_DIR. Tests point it at a
// throwaway directory so a real vault is never touched.
const vaultDir = await mkdtemp(path.join(tmpdir(), 'braindump-vault-'));
process.env.OBSIDIAN_VAULT_DIR = vaultDir;

afterAll(async () => {
  await rm(vaultDir, { recursive: true, force: true });
});

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner, owner };
}

describe('Braindump', () => {
  beforeEach(resetDb);

  it('captures, lists, updates and deletes a dump', async () => {
    const { asOwner } = await setupProject();

    const created = await asOwner.projects({ projectKey: 'MKT' }).braindump.post({
      kind: 'idea',
      body: 'Winter upsell to warm leads',
      tags: ['revenue'],
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      kind: 'idea',
      title: 'Winter upsell to warm leads',
      body: 'Winter upsell to warm leads',
      tags: ['revenue'],
      pinned: false,
      hasAudio: false,
      routedTo: null,
    });

    const entryId = created.data!.id;

    const list = await asOwner.projects({ projectKey: 'MKT' }).braindump.get({ query: {} });
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);

    const pinned = await asOwner.braindump({ entryId }).patch({ pinned: true, kind: 'task' });
    expect(pinned.status).toBe(200);
    expect(pinned.data).toMatchObject({ pinned: true, kind: 'task' });

    const removed = await asOwner.braindump({ entryId }).delete();
    expect(removed.status).toBe(204);

    const after = await asOwner.projects({ projectKey: 'MKT' }).braindump.get({ query: {} });
    expect(after.data).toHaveLength(0);
  });

  it('derives the title from the first line when none is given', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner.projects({ projectKey: 'MKT' }).braindump.post({
      kind: 'note',
      body: '  Tone is too clinical\nJoep asked for warmer copy.',
    });
    expect(created.data).toMatchObject({ title: 'Tone is too clinical' });
  });

  it('rejects a blank body and an unknown kind', async () => {
    const { asOwner } = await setupProject();

    const blank = await asOwner
      .projects({ projectKey: 'MKT' })
      .braindump.post({ kind: 'idea', body: '   ' });
    expect(blank.status).toBe(400);

    const badKind = await asOwner
      .projects({ projectKey: 'MKT' })
      // @ts-expect-error the route only accepts the four kinds
      .braindump.post({ kind: 'rumour', body: 'something' });
    expect(badKind.status).toBe(400);
  });

  it('filters the list by kind and by search', async () => {
    const { asOwner } = await setupProject();
    const braindump = asOwner.projects({ projectKey: 'MKT' }).braindump;
    await braindump.post({ kind: 'idea', body: 'Renegotiate the financier' });
    await braindump.post({ kind: 'note', body: 'Agent tone is too clinical' });

    const ideas = await braindump.get({ query: { kind: 'idea' } });
    expect(ideas.data).toHaveLength(1);
    expect(ideas.data![0]).toMatchObject({ kind: 'idea' });

    const found = await braindump.get({ query: { search: 'clinical' } });
    expect(found.data).toHaveLength(1);
    expect(found.data![0]).toMatchObject({ kind: 'note' });

    const none = await braindump.get({ query: { search: 'nothing matches this' } });
    expect(none.data).toHaveLength(0);
  });

  it('files a dump to the vault and records where it landed', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner.projects({ projectKey: 'MKT' }).braindump.post({
      kind: 'idea',
      body: 'Case study page from the Q1 cohort',
      tags: ['content'],
    });
    const entryId = created.data!.id;

    const routed = await asOwner.braindump({ entryId }).route.post({ destination: 'obsidian' });
    expect(routed.status).toBe(200);
    expect(routed.data).toMatchObject({ routedTo: 'obsidian' });
    expect(routed.data!.routedRef).toContain('Case study page from the Q1 cohort');

    const files = await readdir(vaultDir);
    const written = files.find((name) => name === routed.data!.routedRef);
    expect(written).toBeDefined();
    const note = await readFile(path.join(vaultDir, written!), 'utf8');
    expect(note).toContain('# Case study page from the Q1 cohort');
    expect(note).toContain('  - "content"');
  });

  it('converts a dump into a work item on the board', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .braindump.post({ kind: 'task', body: 'Approve the budget shift before noon' });
    const entryId = created.data!.id;

    const routed = await asOwner.braindump({ entryId }).route.post({ destination: 'issue' });
    expect(routed.status).toBe(200);
    expect(routed.data).toMatchObject({ routedTo: 'issue' });
    expect(routed.data!.routedRef).toStartWith('MKT-');

    const issues = await asOwner.projects({ projectKey: 'MKT' }).issues.get({ query: {} });
    expect(issues.data).toHaveLength(1);
    expect(issues.data![0]).toMatchObject({
      identifier: routed.data!.routedRef!,
      title: 'Approve the budget shift before noon',
    });
  });

  it('rejects a schedule without an agent or a cron expression', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .braindump.post({ kind: 'idea', body: 'Weekly call-review ritual' });
    const entryId = created.data!.id;

    const noAgent = await asOwner.braindump({ entryId }).route.post({ destination: 'schedule' });
    expect(noAgent.status).toBe(400);

    const badCron = await asOwner
      .braindump({ entryId })
      .route.post({ destination: 'schedule', agentId: 999_999, cron: 'not a cron' });
    expect(badCron.status).toBe(400);
  });

  it('counts captures and filed dumps in the statistics', async () => {
    const { asOwner } = await setupProject();
    const braindump = asOwner.projects({ projectKey: 'MKT' }).braindump;
    const first = await braindump.post({ kind: 'idea', body: 'One' });
    await braindump.post({ kind: 'note', body: 'Two' });
    await asOwner.braindump({ entryId: first.data!.id }).route.post({ destination: 'obsidian' });

    const stats = await braindump.stats.get({ query: {} });
    expect(stats.status).toBe(200);
    expect(stats.data).toMatchObject({ routedToday: 1, unsorted: 1, total: 2 });
    expect(stats.data!.daily).toHaveLength(14);
    expect(stats.data!.daily.at(-1)).toMatchObject({ count: 2 });
  });

  it('reports which capture destinations the instance has configured', async () => {
    const { asOwner } = await setupProject();
    const config = await asOwner.projects({ projectKey: 'MKT' }).braindump.config.get();
    expect(config.status).toBe(200);
    expect(config.data).toMatchObject({ obsidian: true });
  });

  it('keeps a non-member out of the project', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .braindump.post({ kind: 'idea', body: 'Private thought' });

    const outsider = await signUpTestUser();
    const asOutsider = authedApi(outsider.cookie);

    const list = await asOutsider.projects({ projectKey: 'MKT' }).braindump.get({ query: {} });
    expect(list.status).toBe(403);

    const read = await asOutsider.braindump({ entryId: created.data!.id }).patch({ pinned: true });
    expect(read.status).toBe(403);
  });

  it('404s on a dump that does not exist', async () => {
    const { asOwner } = await setupProject();
    const missing = await asOwner.braindump({ entryId: 999_999 }).patch({ pinned: true });
    expect(missing.status).toBe(404);
  });
});
