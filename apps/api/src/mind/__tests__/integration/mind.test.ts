import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner, owner };
}

const closeRate = {
  category: 'goals' as const,
  title: 'Q2 close rate is 22% on warm leads',
  body: 'Tracked in the sales dashboard and reviewed weekly.',
  tags: ['sales'],
};

describe('Mind', () => {
  beforeEach(resetDb);

  it('remembers, lists, updates and forgets a fact', async () => {
    const { asOwner } = await setupProject();

    const created = await asOwner.projects({ projectKey: 'MKT' }).mind.facts.post(closeRate);
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      category: 'goals',
      title: 'Q2 close rate is 22% on warm leads',
      tags: ['sales'],
      source: 'manual',
      status: 'unverified',
      pinned: false,
      linksIn: 0,
      linksOut: 0,
    });

    const factId = created.data!.id;

    const list = await asOwner.projects({ projectKey: 'MKT' }).mind.facts.get({ query: {} });
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);

    const verified = await asOwner.mind
      .facts({ factId })
      .patch({ status: 'verified', pinned: true });
    expect(verified.status).toBe(200);
    expect(verified.data).toMatchObject({ status: 'verified', pinned: true });
    expect(verified.data!.verifiedAt).not.toBeNull();

    const removed = await asOwner.mind.facts({ factId }).delete();
    expect(removed.status).toBe(204);

    const after = await asOwner.projects({ projectKey: 'MKT' }).mind.facts.get({ query: {} });
    expect(after.data).toHaveLength(0);
  });

  it('rejects an unknown category and an out-of-range confidence', async () => {
    const { asOwner } = await setupProject();
    const facts = asOwner.projects({ projectKey: 'MKT' }).mind.facts;

    // @ts-expect-error only the nine categories are accepted
    const badCategory = await facts.post({ ...closeRate, category: 'rumours' });
    expect(badCategory.status).toBe(400);

    const badConfidence = await facts.post({ ...closeRate, confidence: 200 });
    expect(badConfidence.status).toBe(400);

    const blankTitle = await facts.post({ ...closeRate, title: '   ' });
    expect(blankTitle.status).toBe(400);
  });

  it('filters the list by category and by search', async () => {
    const { asOwner } = await setupProject();
    const facts = asOwner.projects({ projectKey: 'MKT' }).mind.facts;
    await facts.post(closeRate);
    await facts.post({ category: 'routines', title: 'Morning routine runs at 08:00' });

    const goals = await facts.get({ query: { category: 'goals' } });
    expect(goals.data).toHaveLength(1);
    expect(goals.data![0]).toMatchObject({ category: 'goals' });

    const found = await facts.get({ query: { search: 'morning' } });
    expect(found.data).toHaveLength(1);
    expect(found.data![0]).toMatchObject({ category: 'routines' });
  });

  it('leaves archived facts out of the default list', async () => {
    const { asOwner } = await setupProject();
    const facts = asOwner.projects({ projectKey: 'MKT' }).mind.facts;
    const created = await facts.post(closeRate);
    await asOwner.mind.facts({ factId: created.data!.id }).patch({ category: 'archive' });

    const list = await facts.get({ query: {} });
    expect(list.data).toHaveLength(0);

    const archived = await facts.get({ query: { category: 'archive' } });
    expect(archived.data).toHaveLength(1);
  });

  it('links two facts and reports the link counts', async () => {
    const { asOwner } = await setupProject();
    const facts = asOwner.projects({ projectKey: 'MKT' }).mind.facts;
    const goal = await facts.post(closeRate);
    const routine = await facts.post({ category: 'routines', title: 'Weekly pipeline review' });

    const linked = await asOwner.mind
      .facts({ factId: goal.data!.id })
      .links.post({ toFactId: routine.data!.id });
    expect(linked.status).toBe(200);
    expect(linked.data).toMatchObject({ linksOut: 1 });

    const targets = await asOwner.mind.facts({ factId: goal.data!.id }).links.get();
    expect(targets.data).toHaveLength(1);
    expect(targets.data![0]).toMatchObject({ id: routine.data!.id, linksIn: 1 });

    // Linking twice is not an error; the pair is unique.
    const again = await asOwner.mind
      .facts({ factId: goal.data!.id })
      .links.post({ toFactId: routine.data!.id });
    expect(again.data).toMatchObject({ linksOut: 1 });

    const unlinked = await asOwner.mind
      .facts({ factId: goal.data!.id })
      .links({ toFactId: routine.data!.id })
      .delete();
    expect(unlinked.status).toBe(204);
  });

  it('refuses a self-link and a link to a fact in another project', async () => {
    const { asOwner } = await setupProject();
    const facts = asOwner.projects({ projectKey: 'MKT' }).mind.facts;
    const goal = await facts.post(closeRate);

    const self = await asOwner.mind
      .facts({ factId: goal.data!.id })
      .links.post({ toFactId: goal.data!.id });
    expect(self.status).toBe(400);

    await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
    const elsewhere = await asOwner
      .projects({ projectKey: 'OPS' })
      .mind.facts.post({ category: 'infra', title: 'Runs on one box' });

    const crossProject = await asOwner.mind
      .facts({ factId: goal.data!.id })
      .links.post({ toFactId: elsewhere.data!.id });
    expect(crossProject.status).toBe(404);
  });

  it('recalls the pinned facts first and records the read', async () => {
    const { asOwner } = await setupProject();
    const facts = asOwner.projects({ projectKey: 'MKT' }).mind.facts;
    const pinned = await facts.post({ ...closeRate, pinned: true });
    await facts.post({ category: 'infra', title: 'Postgres runs on the app box' });

    const answer = await asOwner
      .projects({ projectKey: 'MKT' })
      .mind.recall.post({ query: 'postgres' });
    expect(answer.status).toBe(200);
    // The pinned fact leads even though it does not match the query.
    expect(answer.data![0]).toMatchObject({ id: pinned.data!.id });
    expect(answer.data).toHaveLength(2);

    const recalls = await asOwner.projects({ projectKey: 'MKT' }).mind.recalls.get({ query: {} });
    expect(recalls.data!.length).toBe(2);
    expect(recalls.data![0]).toMatchObject({ actorKind: 'user', query: 'postgres' });

    const overview = await asOwner.projects({ projectKey: 'MKT' }).mind.overview.get({ query: {} });
    expect(overview.data).toMatchObject({ totalFacts: 2, recallsToday: 2 });
  });

  it('never recalls an archived fact', async () => {
    const { asOwner } = await setupProject();
    const facts = asOwner.projects({ projectKey: 'MKT' }).mind.facts;
    const created = await facts.post({ category: 'knowledge', title: 'An old pricing rule' });
    await asOwner.mind.facts({ factId: created.data!.id }).patch({ category: 'archive' });

    const answer = await asOwner
      .projects({ projectKey: 'MKT' })
      .mind.recall.post({ query: 'pricing' });
    expect(answer.data).toHaveLength(0);
  });

  it('reports health and the busiest hubs in the overview', async () => {
    const { asOwner } = await setupProject();
    const facts = asOwner.projects({ projectKey: 'MKT' }).mind.facts;
    const hub = await facts.post(closeRate);
    const spoke = await facts.post({ category: 'routines', title: 'Weekly review' });
    await asOwner.mind.facts({ factId: hub.data!.id }).links.post({ toFactId: spoke.data!.id });
    await asOwner.mind.facts({ factId: hub.data!.id }).patch({ status: 'conflicted' });

    const overview = await asOwner.projects({ projectKey: 'MKT' }).mind.overview.get({ query: {} });
    expect(overview.status).toBe(200);
    expect(overview.data).toMatchObject({ totalFacts: 2, links: 1 });
    expect(overview.data!.health).toMatchObject({ conflicted: 1, orphans: 0, stale: 0 });
    expect(overview.data!.mostLinked[0]).toMatchObject({ id: hub.data!.id, linksOut: 1 });
    expect(overview.data!.daily).toHaveLength(14);
  });

  it('remembers every braindump capture as an unverified daily note', async () => {
    const { asOwner } = await setupProject();

    await asOwner
      .projects({ projectKey: 'MKT' })
      .braindump.post({ kind: 'idea', body: 'Winter upsell to warm leads', tags: ['revenue'] });

    const notes = await asOwner
      .projects({ projectKey: 'MKT' })
      .mind.facts.get({ query: { category: 'daily_notes' } });
    expect(notes.data).toHaveLength(1);
    expect(notes.data![0]).toMatchObject({
      title: 'Winter upsell to warm leads',
      source: 'braindump',
      status: 'unverified',
      tags: ['revenue'],
    });
    expect(notes.data![0]!.braindumpEntryId).not.toBeNull();
  });

  it('keeps a non-member out of the memory', async () => {
    const { asOwner } = await setupProject();
    const created = await asOwner.projects({ projectKey: 'MKT' }).mind.facts.post(closeRate);

    const outsider = await signUpTestUser();
    const asOutsider = authedApi(outsider.cookie);

    const list = await asOutsider.projects({ projectKey: 'MKT' }).mind.facts.get({ query: {} });
    expect(list.status).toBe(403);

    const asked = await asOutsider
      .projects({ projectKey: 'MKT' })
      .mind.recall.post({ query: 'close rate' });
    expect(asked.status).toBe(403);

    const edited = await asOutsider.mind
      .facts({ factId: created.data!.id })
      .patch({ pinned: true });
    expect(edited.status).toBe(403);
  });

  it('404s on a fact that does not exist', async () => {
    const { asOwner } = await setupProject();
    const missing = await asOwner.mind.facts({ factId: 999_999 }).patch({ pinned: true });
    expect(missing.status).toBe(404);
  });
});
