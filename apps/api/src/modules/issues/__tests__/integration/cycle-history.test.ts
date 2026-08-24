import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Dates relative to today, so a cycle's derived status does not depend on when the
// suite runs.
function day(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columns = view.data!.columns;
  return {
    asOwner,
    columnId: columns[0].id,
    doneColumnId: columns.find((c) => c.stateType === 'completed')!.id,
  };
}

function createCycle(api: Api, body: Record<string, unknown>) {
  return api
    .projects({ projectKey: 'MKT' })
    .cycles.post({ name: 'Sprint', startDate: day(-5), endDate: day(6), ...body });
}

// Moving a running cycle's end date into the past finishes it — the status follows
// from the dates, so this is what "the cycle ended" means.
function endCycle(api: Api, cycleId: number) {
  return api.cycles({ cycleId }).patch({ endDate: day(-1) });
}

function createIssue(api: Api, columnId: number, body: Record<string, unknown> = {}) {
  return api.projects({ projectKey: 'MKT' }).issues.post({ title: 'Task', columnId, ...body });
}

function history(api: Api, issueId: number) {
  return api.issues({ issueId }).cycles.get();
}

// A running cycle and the one after it, which the unfinished work is carried over to.
async function twoCycles(api: Api) {
  const first = (await createCycle(api, { name: 'Sprint 1' })).data!;
  const second = (
    await createCycle(api, { name: 'Sprint 2', startDate: day(10), endDate: day(16) })
  ).data!;
  return { first, second };
}

describe('issue cycle history', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('is empty for an issue that was never planned into a cycle', async () => {
    const { asOwner, columnId } = await setup();
    const issue = (await createIssue(asOwner, columnId)).data!;

    const res = await history(asOwner, issue.id);
    expect(res.status).toBe(200);
    expect(res.data).toEqual([]);
  });

  it('lists the cycle an issue is on now, with the cycle dates', async () => {
    const { asOwner, columnId } = await setup();
    const cycle = (await createCycle(asOwner, { name: 'Sprint 1' })).data!;
    const issue = (await createIssue(asOwner, columnId, { cycleId: cycle.id })).data!;

    const res = await history(asOwner, issue.id);
    expect(res.data).toMatchObject([
      {
        cycleId: cycle.id,
        name: 'Sprint 1',
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        status: 'active',
        leftAt: null,
      },
    ]);
  });

  it('keeps a cycle the issue was still on when it ended, oldest first', async () => {
    const { asOwner, columnId } = await setup();
    const { first, second } = await twoCycles(asOwner);
    const issue = (await createIssue(asOwner, columnId, { cycleId: first.id })).data!;
    await endCycle(asOwner, first.id);
    await asOwner.issues({ issueId: issue.id }).patch({ cycleId: second.id });

    const res = await history(asOwner, issue.id);
    expect(res.data!.map((e) => e.name)).toEqual(['Sprint 1', 'Sprint 2']);
    expect(res.data![0].leftAt).not.toBeNull();
    expect(res.data![1].leftAt).toBeNull();
  });

  it('drops a cycle the issue left while that cycle was still running', async () => {
    const { asOwner, columnId } = await setup();
    const { first, second } = await twoCycles(asOwner);
    const issue = (await createIssue(asOwner, columnId, { cycleId: first.id })).data!;
    await asOwner.issues({ issueId: issue.id }).patch({ cycleId: second.id });

    expect((await history(asOwner, issue.id)).data!.map((e) => e.name)).toEqual(['Sprint 2']);
  });

  it('drops a cycle the issue was unplanned from before it ended', async () => {
    const { asOwner, columnId } = await setup();
    const cycle = (await createCycle(asOwner, {})).data!;
    const issue = (await createIssue(asOwner, columnId, { cycleId: cycle.id })).data!;
    await asOwner.issues({ issueId: issue.id }).patch({ cycleId: null });

    expect((await history(asOwner, issue.id)).data).toEqual([]);
  });

  it('keeps a finished cycle the issue was unplanned from afterwards', async () => {
    const { asOwner, columnId } = await setup();
    const cycle = (await createCycle(asOwner, { name: 'Sprint 1' })).data!;
    const issue = (await createIssue(asOwner, columnId, { cycleId: cycle.id })).data!;
    await endCycle(asOwner, cycle.id);
    await asOwner.issues({ issueId: issue.id }).patch({ cycleId: null });

    const res = await history(asOwner, issue.id);
    expect(res.data!.map((e) => e.name)).toEqual(['Sprint 1']);
    expect(res.data![0].leftAt).not.toBeNull();
  });

  it('lists a cycle once however often the issue was planned in and out of it', async () => {
    const { asOwner, columnId } = await setup();
    const { first, second } = await twoCycles(asOwner);
    const issue = (await createIssue(asOwner, columnId, { cycleId: first.id })).data!;
    await asOwner.issues({ issueId: issue.id }).patch({ cycleId: second.id });
    await asOwner.issues({ issueId: issue.id }).patch({ cycleId: first.id });
    await asOwner.issues({ issueId: issue.id }).patch({ cycleId: first.id });

    expect((await history(asOwner, issue.id)).data!.map((e) => e.name)).toEqual(['Sprint 1']);
  });

  it('lists a cycle once when it ends after the issue was planned in and out of it', async () => {
    const { asOwner, columnId } = await setup();
    const { first, second } = await twoCycles(asOwner);
    const issue = (await createIssue(asOwner, columnId, { cycleId: first.id })).data!;
    await asOwner.issues({ issueId: issue.id }).patch({ cycleId: second.id });
    await asOwner.issues({ issueId: issue.id }).patch({ cycleId: first.id });
    await endCycle(asOwner, first.id);

    expect((await history(asOwner, issue.id)).data!.map((e) => e.name)).toEqual(['Sprint 1']);
  });

  it('records the carry-over a transfer of unfinished issues makes', async () => {
    const { asOwner, columnId, doneColumnId } = await setup();
    const { first, second } = await twoCycles(asOwner);
    const open = (await createIssue(asOwner, columnId, { cycleId: first.id })).data!;
    const done = (await createIssue(asOwner, doneColumnId, { cycleId: first.id })).data!;
    await endCycle(asOwner, first.id);

    await asOwner.cycles({ cycleId: first.id }).transfer.post({ targetCycleId: second.id });

    expect((await history(asOwner, open.id)).data!.map((e) => e.name)).toEqual([
      'Sprint 1',
      'Sprint 2',
    ]);
    expect((await history(asOwner, done.id)).data!.map((e) => e.name)).toEqual(['Sprint 1']);
  });

  it('records the carry-over a bulk cycle change makes', async () => {
    const { asOwner, columnId } = await setup();
    const { first, second } = await twoCycles(asOwner);
    const one = (await createIssue(asOwner, columnId, { cycleId: first.id })).data!;
    const two = (await createIssue(asOwner, columnId, { cycleId: first.id })).data!;
    await endCycle(asOwner, first.id);

    await asOwner
      .projects({ projectKey: 'MKT' })
      .issues.bulk.patch({ ids: [one.id, two.id], patch: { cycleId: second.id } });

    for (const issue of [one, two]) {
      expect((await history(asOwner, issue.id)).data!.map((e) => e.name)).toEqual([
        'Sprint 1',
        'Sprint 2',
      ]);
    }
  });

  it('counts a cycle the issue was still on when it was finished early', async () => {
    const { asOwner, columnId } = await setup();
    const { first, second } = await twoCycles(asOwner);
    const carried = (await createIssue(asOwner, columnId, { cycleId: first.id })).data!;
    const dropped = (await createIssue(asOwner, columnId, { cycleId: first.id })).data!;
    await asOwner.issues({ issueId: dropped.id }).patch({ cycleId: null });

    await asOwner.cycles({ cycleId: first.id }).finish.post();
    await asOwner.issues({ issueId: carried.id }).patch({ cycleId: second.id });

    expect((await history(asOwner, carried.id)).data!.map((e) => e.name)).toEqual([
      'Sprint 1',
      'Sprint 2',
    ]);
    expect((await history(asOwner, dropped.id)).data).toEqual([]);
  });

  it('drops a deleted cycle from the history', async () => {
    const { asOwner, columnId } = await setup();
    const { first, second } = await twoCycles(asOwner);
    const issue = (await createIssue(asOwner, columnId, { cycleId: first.id })).data!;
    await endCycle(asOwner, first.id);
    await asOwner.issues({ issueId: issue.id }).patch({ cycleId: second.id });

    await asOwner.cycles({ cycleId: first.id }).delete();

    expect((await history(asOwner, issue.id)).data!.map((e) => e.name)).toEqual(['Sprint 2']);
  });

  it('denies a non-member', async () => {
    const { asOwner, columnId } = await setup();
    const issue = (await createIssue(asOwner, columnId)).data!;
    const outsider = authedApi((await signUpTestUser()).cookie);

    expect((await history(outsider, issue.id)).status).toBe(403);
  });
});
