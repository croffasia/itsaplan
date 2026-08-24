import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';

// Cycles are time-boxed periods of work inside a project (sprints). Issues link to
// one through issue.cycleId. The status (upcoming/active/completed) follows from the
// dates against today and progress from the linked issues' states — neither is
// stored. Cycles of one project may not overlap, so at most one is ever active.

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
    owner,
    asOwner,
    columnId: columns[0].id,
    startedColumnId: columns.find((c) => c.stateType === 'started')!.id,
    doneColumnId: columns.find((c) => c.stateType === 'completed')!.id,
    canceledColumnId: columns.find((c) => c.stateType === 'canceled')!.id,
  };
}

const cycles = (api: Api) => api.projects({ projectKey: 'MKT' }).cycles;

function createCycle(api: Api, body: Record<string, unknown>) {
  return cycles(api).post({ name: 'Sprint 1', startDate: day(0), endDate: day(6), ...body });
}

function createIssue(api: Api, columnId: number, body: Record<string, unknown> = {}) {
  return api.projects({ projectKey: 'MKT' }).issues.post({ title: 'Task', columnId, ...body });
}

describe('cycles', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create', () => {
    it('creates a cycle and lists it', async () => {
      const { asOwner } = await setup();
      const created = await createCycle(asOwner, { name: 'Sprint 1', goal: 'Ship the beta' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        name: 'Sprint 1',
        goal: 'Ship the beta',
        status: 'active',
        progress: { completed: 0, canceled: 0, total: 0 },
      });

      const list = await cycles(asOwner).get();
      expect(list.data!.map((c) => c.name)).toEqual(['Sprint 1']);
    });

    it('derives the status from the dates', async () => {
      const { asOwner } = await setup();
      const past = await createCycle(asOwner, { startDate: day(-14), endDate: day(-8) });
      const current = await createCycle(asOwner, { startDate: day(-1), endDate: day(5) });
      const future = await createCycle(asOwner, { startDate: day(10), endDate: day(16) });

      expect(past.data!.status).toBe('completed');
      expect(current.data!.status).toBe('active');
      expect(future.data!.status).toBe('upcoming');
    });

    it('lists cycles oldest first', async () => {
      const { asOwner } = await setup();
      await createCycle(asOwner, { name: 'Later', startDate: day(10), endDate: day(16) });
      await createCycle(asOwner, { name: 'Earlier', startDate: day(0), endDate: day(6) });

      const list = await cycles(asOwner).get();
      expect(list.data!.map((c) => c.name)).toEqual(['Earlier', 'Later']);
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setup();
      expect((await createCycle(asOwner, { name: '' })).status).toBe(400);
    });

    it('rejects a date that is not YYYY-MM-DD', async () => {
      const { asOwner } = await setup();
      expect((await createCycle(asOwner, { startDate: '01.02.2026' })).status).toBe(400);
    });

    it('rejects an end date before the start date', async () => {
      const { asOwner } = await setup();
      const res = await createCycle(asOwner, { startDate: day(6), endDate: day(0) });
      expect(res.status).toBe(400);
    });

    it('accepts a cycle that starts and ends on the same day', async () => {
      const { asOwner } = await setup();
      expect((await createCycle(asOwner, { startDate: day(3), endDate: day(3) })).status).toBe(201);
    });

    it('rejects dates that overlap another cycle', async () => {
      const { asOwner } = await setup();
      await createCycle(asOwner, { startDate: day(0), endDate: day(6) });

      const overlapping = await createCycle(asOwner, { startDate: day(6), endDate: day(12) });
      expect(overlapping.status).toBe(400);

      const adjacent = await createCycle(asOwner, { startDate: day(7), endDate: day(13) });
      expect(adjacent.status).toBe(201);
    });

    it('allows the same dates in another project', async () => {
      const { asOwner } = await setup();
      await createCycle(asOwner, { startDate: day(0), endDate: day(6) });
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });

      const other = await asOwner
        .projects({ projectKey: 'OPS' })
        .cycles.post({ name: 'Sprint 1', startDate: day(0), endDate: day(6) });
      expect(other.status).toBe(201);
    });
  });

  describe('list', () => {
    // Two finished cycles, one running, one ahead — enough to tell the planned list
    // and the archive apart, and to page the archive.
    async function fourCycles(api: Api) {
      await createCycle(api, { name: 'Old', startDate: day(-21), endDate: day(-15) });
      await createCycle(api, { name: 'Last', startDate: day(-14), endDate: day(-8) });
      await createCycle(api, { name: 'Current', startDate: day(-1), endDate: day(5) });
      await createCycle(api, { name: 'Next', startDate: day(10), endDate: day(16) });
    }

    it('leaves the finished cycles out of the planned list', async () => {
      const { asOwner } = await setup();
      await fourCycles(asOwner);

      const planned = await cycles(asOwner).get({ query: { status: 'planned' } });
      expect(planned.data!.map((c) => c.name)).toEqual(['Current', 'Next']);
    });

    it('lists the finished cycles newest first, with how many there are', async () => {
      const { asOwner } = await setup();
      await fourCycles(asOwner);

      const archive = await cycles(asOwner).completed.get({ query: {} });
      expect(archive.data!.total).toBe(2);
      expect(archive.data!.items.map((c) => c.name)).toEqual(['Last', 'Old']);
    });

    it('pages the finished cycles', async () => {
      const { asOwner } = await setup();
      await fourCycles(asOwner);

      const first = await cycles(asOwner).completed.get({ query: { pageSize: 1 } });
      expect(first.data).toMatchObject({ total: 2, page: 1, pageSize: 1 });
      expect(first.data!.items.map((c) => c.name)).toEqual(['Last']);

      const second = await cycles(asOwner).completed.get({ query: { page: 2, pageSize: 1 } });
      expect(second.data!.items.map((c) => c.name)).toEqual(['Old']);

      const past = await cycles(asOwner).completed.get({ query: { page: 3, pageSize: 1 } });
      expect(past.data!.items).toEqual([]);
      expect(past.data!.total).toBe(2);
    });

    it('reports an empty archive when nothing has finished', async () => {
      const { asOwner } = await setup();
      await createCycle(asOwner, { startDate: day(0), endDate: day(6) });

      const archive = await cycles(asOwner).completed.get({ query: {} });
      expect(archive.data).toMatchObject({ total: 0, items: [] });
    });

    it('rejects a page or page size outside its bounds', async () => {
      const { asOwner } = await setup();
      expect((await cycles(asOwner).completed.get({ query: { pageSize: 0 } })).status).toBe(400);
      expect((await cycles(asOwner).completed.get({ query: { pageSize: 101 } })).status).toBe(400);
      expect((await cycles(asOwner).completed.get({ query: { page: 0 } })).status).toBe(400);
    });

    it('denies a non-member the archive', async () => {
      await setup();
      const outsider = authedApi((await signUpTestUser()).cookie);
      const res = await outsider
        .projects({ projectKey: 'MKT' })
        .cycles.completed.get({ query: {} });
      expect(res.status).toBe(403);
    });
  });

  describe('progress', () => {
    it('counts the linked issues by their state type', async () => {
      const { asOwner, columnId, startedColumnId, doneColumnId } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      await createIssue(asOwner, columnId, { cycleId: cycle.id });
      await createIssue(asOwner, startedColumnId, { cycleId: cycle.id });
      await createIssue(asOwner, doneColumnId, { cycleId: cycle.id });
      await createIssue(asOwner, columnId);

      const read = await asOwner.cycles({ cycleId: cycle.id }).get();
      expect(read.data!.progress).toMatchObject({ total: 3, completed: 1, canceled: 0 });
    });
  });

  describe('update', () => {
    it('moves both dates of an upcoming cycle', async () => {
      const { asOwner } = await setup();
      const cycle = (await createCycle(asOwner, { startDate: day(10), endDate: day(16) })).data!;

      const res = await asOwner
        .cycles({ cycleId: cycle.id })
        .patch({ name: 'Sprint 2', startDate: day(20), endDate: day(26) });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ name: 'Sprint 2', status: 'upcoming' });
    });

    // What a cycle is called and what it is for describe the work, so they stay
    // editable whatever state its dates put it in; the dates themselves do not.
    it('keeps the start date of a running cycle and lets its end move', async () => {
      const { asOwner } = await setup();
      const running = (await createCycle(asOwner, { startDate: day(-1), endDate: day(5) })).data!;

      const moved = await asOwner.cycles({ cycleId: running.id }).patch({ startDate: day(0) });
      expect(moved.status).toBe(400);

      const extended = await asOwner.cycles({ cycleId: running.id }).patch({ endDate: day(9) });
      expect(extended.status).toBe(200);
      expect(extended.data).toMatchObject({ status: 'active' });

      const renamed = await asOwner
        .cycles({ cycleId: running.id })
        .patch({ name: 'Renamed', goal: 'Ship it' });
      expect(renamed.status).toBe(200);
    });

    it('keeps both dates of a completed cycle', async () => {
      const { asOwner } = await setup();
      const past = (await createCycle(asOwner, { startDate: day(-14), endDate: day(-8) })).data!;

      expect((await asOwner.cycles({ cycleId: past.id }).patch({ endDate: day(-7) })).status).toBe(
        400,
      );
      expect(
        (await asOwner.cycles({ cycleId: past.id }).patch({ startDate: day(-13) })).status,
      ).toBe(400);
      expect(
        (await asOwner.cycles({ cycleId: past.id }).patch({ name: 'Q2 wrap-up' })).status,
      ).toBe(200);
    });

    // The form sends every field on save, so re-sending the dates a cycle already has
    // is not an attempt to move them.
    it('accepts a save that resends the unchanged dates of a completed cycle', async () => {
      const { asOwner } = await setup();
      const past = (await createCycle(asOwner, { startDate: day(-14), endDate: day(-8) })).data!;

      const res = await asOwner
        .cycles({ cycleId: past.id })
        .patch({ name: 'Sprint 0', goal: 'Set up', startDate: day(-14), endDate: day(-8) });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ name: 'Sprint 0', goal: 'Set up' });
    });

    it('rejects new dates that overlap another cycle', async () => {
      const { asOwner } = await setup();
      await createCycle(asOwner, { startDate: day(0), endDate: day(6) });
      const second = (await createCycle(asOwner, { startDate: day(7), endDate: day(13) })).data!;

      const res = await asOwner.cycles({ cycleId: second.id }).patch({ startDate: day(6) });
      expect(res.status).toBe(400);
    });

    it('keeps its own dates out of the overlap check', async () => {
      const { asOwner } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      const res = await asOwner.cycles({ cycleId: cycle.id }).patch({ name: 'Renamed' });
      expect(res.status).toBe(200);
    });

    it('404s on an unknown cycle', async () => {
      const { asOwner } = await setup();
      expect((await asOwner.cycles({ cycleId: 999999 }).patch({ name: 'x' })).status).toBe(404);
    });
  });

  describe('delete', () => {
    it('deletes the cycle and leaves its issues without one', async () => {
      const { asOwner, columnId } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      const issue = (await createIssue(asOwner, columnId, { cycleId: cycle.id })).data!;

      expect((await asOwner.cycles({ cycleId: cycle.id }).delete()).status).toBe(204);
      expect((await cycles(asOwner).get()).data).toHaveLength(0);
      expect((await asOwner.issues({ issueId: issue.id }).get()).data!.cycle).toBeNull();
    });
  });

  describe('issue link', () => {
    it('plans an issue into a cycle and unplans it', async () => {
      const { asOwner, columnId } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      const issue = (await createIssue(asOwner, columnId, { cycleId: cycle.id })).data!;
      expect(issue.cycle).toMatchObject({ id: cycle.id, name: 'Sprint 1' });

      const cleared = await asOwner.issues({ issueId: issue.id }).patch({ cycleId: null });
      expect(cleared.data!.cycle).toBeNull();
    });

    it('rejects a cycle from another project', async () => {
      const { asOwner, columnId } = await setup();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = (
        await asOwner
          .projects({ projectKey: 'OPS' })
          .cycles.post({ name: 'Other', startDate: day(0), endDate: day(6) })
      ).data!;

      const res = await createIssue(asOwner, columnId, { cycleId: foreign.id });
      expect(res.status).toBe(400);
    });

    it('rejects a completed cycle', async () => {
      const { asOwner, columnId } = await setup();
      const past = (await createCycle(asOwner, { startDate: day(-14), endDate: day(-8) })).data!;

      expect((await createIssue(asOwner, columnId, { cycleId: past.id })).status).toBe(400);

      const issue = (await createIssue(asOwner, columnId)).data!;
      const res = await asOwner.issues({ issueId: issue.id }).patch({ cycleId: past.id });
      expect(res.status).toBe(400);
      expect((await asOwner.issues({ issueId: issue.id }).get()).data!.cycle).toBeNull();
    });

    it('keeps an issue on the cycle it was planned into once that cycle ends', async () => {
      const { asOwner, columnId } = await setup();
      const cycle = (await createCycle(asOwner, { startDate: day(-5), endDate: day(6) })).data!;
      const issue = (await createIssue(asOwner, columnId, { cycleId: cycle.id })).data!;
      await asOwner.cycles({ cycleId: cycle.id }).patch({ endDate: day(-1) });

      const renamed = await asOwner.issues({ issueId: issue.id }).patch({ title: 'Still planned' });
      expect(renamed.status).toBe(200);
      expect(renamed.data!.cycle).toMatchObject({ id: cycle.id });

      const resent = await asOwner.issues({ issueId: issue.id }).patch({ cycleId: cycle.id });
      expect(resent.status).toBe(200);

      const cleared = await asOwner.issues({ issueId: issue.id }).patch({ cycleId: null });
      expect(cleared.data!.cycle).toBeNull();
    });

    it('filters the issue list by cycle', async () => {
      const { asOwner, columnId } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      await createIssue(asOwner, columnId, { title: 'Planned', cycleId: cycle.id });
      await createIssue(asOwner, columnId, { title: 'Unplanned' });

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.get({ query: { cycleId: cycle.id } });
      expect(res.data!.map((i) => i.title)).toEqual(['Planned']);
    });
  });

  describe('transfer', () => {
    it('moves the unfinished issues and leaves the finished ones', async () => {
      const { asOwner, columnId, doneColumnId } = await setup();
      const from = (await createCycle(asOwner, {})).data!;
      const to = (await createCycle(asOwner, { startDate: day(10), endDate: day(16) })).data!;
      const open = (await createIssue(asOwner, columnId, { cycleId: from.id })).data!;
      const done = (await createIssue(asOwner, doneColumnId, { cycleId: from.id })).data!;

      const res = await asOwner
        .cycles({ cycleId: from.id })
        .transfer.post({ targetCycleId: to.id });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ moved: 1 });
      expect((await asOwner.issues({ issueId: open.id }).get()).data!.cycle).toMatchObject({
        id: to.id,
      });
      expect((await asOwner.issues({ issueId: done.id }).get()).data!.cycle).toMatchObject({
        id: from.id,
      });
    });

    it('unplans the unfinished issues when the target is null', async () => {
      const { asOwner, columnId } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      const issue = (await createIssue(asOwner, columnId, { cycleId: cycle.id })).data!;

      const res = await asOwner
        .cycles({ cycleId: cycle.id })
        .transfer.post({ targetCycleId: null });
      expect(res.data).toMatchObject({ moved: 1 });
      expect((await asOwner.issues({ issueId: issue.id }).get()).data!.cycle).toBeNull();
    });

    it('rejects the cycle itself as the target', async () => {
      const { asOwner } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      const res = await asOwner
        .cycles({ cycleId: cycle.id })
        .transfer.post({ targetCycleId: cycle.id });
      expect(res.status).toBe(400);
    });

    it('rejects a completed target cycle', async () => {
      const { asOwner, columnId } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      const past = (await createCycle(asOwner, { startDate: day(-14), endDate: day(-8) })).data!;
      const issue = (await createIssue(asOwner, columnId, { cycleId: cycle.id })).data!;

      const res = await asOwner
        .cycles({ cycleId: cycle.id })
        .transfer.post({ targetCycleId: past.id });
      expect(res.status).toBe(400);
      expect((await asOwner.issues({ issueId: issue.id }).get()).data!.cycle).toMatchObject({
        id: cycle.id,
      });
    });

    it('rejects a target cycle from another project', async () => {
      const { asOwner } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = (
        await asOwner
          .projects({ projectKey: 'OPS' })
          .cycles.post({ name: 'Other', startDate: day(0), endDate: day(6) })
      ).data!;

      const res = await asOwner
        .cycles({ cycleId: cycle.id })
        .transfer.post({ targetCycleId: foreign.id });
      expect(res.status).toBe(400);
    });
  });

  describe('finish', () => {
    it('completes a running cycle without touching its planned end date', async () => {
      const { asOwner } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;

      const res = await asOwner.cycles({ cycleId: cycle.id }).finish.post();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ status: 'completed', endDate: cycle.endDate });
      expect(res.data!.completedAt).not.toBeNull();
    });

    it('moves the cycle out of the planned list and the options into the archive', async () => {
      const { asOwner } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      await asOwner.cycles({ cycleId: cycle.id }).finish.post();

      expect((await cycles(asOwner).get({ query: { status: 'planned' } })).data).toEqual([]);
      expect((await cycles(asOwner).options.get()).data).toEqual([]);
      const archive = await cycles(asOwner).completed.get({ query: {} });
      expect(archive.data!.items.map((c) => c.id)).toEqual([cycle.id]);
    });

    it('takes no new issue once it is finished', async () => {
      const { asOwner, columnId } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      await asOwner.cycles({ cycleId: cycle.id }).finish.post();

      expect((await createIssue(asOwner, columnId, { cycleId: cycle.id })).status).toBe(400);
    });

    it('keeps its issues, which the transfer route still moves out', async () => {
      const { asOwner, columnId } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      const issue = (await createIssue(asOwner, columnId, { cycleId: cycle.id })).data!;
      await asOwner.cycles({ cycleId: cycle.id }).finish.post();

      expect((await asOwner.issues({ issueId: issue.id }).get()).data!.cycle).toMatchObject({
        id: cycle.id,
      });

      const moved = await asOwner
        .cycles({ cycleId: cycle.id })
        .transfer.post({ targetCycleId: null });
      expect(moved.data).toMatchObject({ moved: 1 });
      expect((await asOwner.issues({ issueId: issue.id }).get()).data!.cycle).toBeNull();
    });

    it('rejects an upcoming cycle and one that is already finished', async () => {
      const { asOwner } = await setup();
      const upcoming = (await createCycle(asOwner, { startDate: day(10), endDate: day(16) })).data!;
      expect((await asOwner.cycles({ cycleId: upcoming.id }).finish.post()).status).toBe(400);

      const past = (await createCycle(asOwner, { startDate: day(-14), endDate: day(-8) })).data!;
      expect((await asOwner.cycles({ cycleId: past.id }).finish.post()).status).toBe(400);

      const cycle = (await createCycle(asOwner, {})).data!;
      expect((await asOwner.cycles({ cycleId: cycle.id }).finish.post()).status).toBe(200);
      expect((await asOwner.cycles({ cycleId: cycle.id }).finish.post()).status).toBe(400);
    });

    it('frees the days it gave up and keeps the ones it ran', async () => {
      const { asOwner } = await setup();
      const cycle = (await createCycle(asOwner, { startDate: day(-2), endDate: day(6) })).data!;
      await asOwner.cycles({ cycleId: cycle.id }).finish.post();

      expect((await createCycle(asOwner, { startDate: day(1), endDate: day(6) })).status).toBe(201);
      expect((await createCycle(asOwner, { startDate: day(-4), endDate: day(-2) })).status).toBe(
        400,
      );
    });

    it('404s on an unknown cycle', async () => {
      const { asOwner } = await setup();
      expect((await asOwner.cycles({ cycleId: 999999 }).finish.post()).status).toBe(404);
    });
  });

  describe('start next', () => {
    it('finishes the running cycle, starts the next one today and carries the work over', async () => {
      const { asOwner, columnId, doneColumnId, canceledColumnId } = await setup();
      const running = (await createCycle(asOwner, { startDate: day(-2), endDate: day(6) })).data!;
      const next = (await createCycle(asOwner, { startDate: day(10), endDate: day(16) })).data!;
      const open = (await createIssue(asOwner, columnId, { cycleId: running.id })).data!;
      const done = (await createIssue(asOwner, doneColumnId, { cycleId: running.id })).data!;
      const canceled = (await createIssue(asOwner, canceledColumnId, { cycleId: running.id }))
        .data!;

      const res = await asOwner.cycles({ cycleId: running.id })['start-next'].post();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        moved: 1,
        cycle: { id: next.id, endDate: next.endDate, status: 'active' },
      });
      expect(new Date(res.data!.cycle.startDate).toISOString().slice(0, 10)).toBe(day(0));

      const finished = (await asOwner.cycles({ cycleId: running.id }).get()).data!;
      expect(finished.status).toBe('completed');
      expect(finished.endDate).toEqual(running.endDate);

      expect((await asOwner.issues({ issueId: open.id }).get()).data!.cycle).toMatchObject({
        id: next.id,
      });
      for (const stayed of [done, canceled]) {
        expect((await asOwner.issues({ issueId: stayed.id }).get()).data!.cycle).toMatchObject({
          id: running.id,
        });
      }
    });

    it('rejects a project with no upcoming cycle', async () => {
      const { asOwner } = await setup();
      const running = (await createCycle(asOwner, {})).data!;
      await createCycle(asOwner, { startDate: day(-14), endDate: day(-8) });

      const res = await asOwner.cycles({ cycleId: running.id })['start-next'].post();
      expect(res.status).toBe(400);
      expect((await asOwner.cycles({ cycleId: running.id }).get()).data!.status).toBe('active');
    });

    it('leaves the started cycle free to move its end date', async () => {
      const { asOwner } = await setup();
      const running = (await createCycle(asOwner, { startDate: day(-2), endDate: day(6) })).data!;
      const next = (await createCycle(asOwner, { startDate: day(10), endDate: day(16) })).data!;
      await asOwner.cycles({ cycleId: running.id })['start-next'].post();

      expect((await asOwner.cycles({ cycleId: next.id }).patch({ endDate: day(20) })).status).toBe(
        200,
      );
    });

    it('rejects a cycle that is not running', async () => {
      const { asOwner } = await setup();
      const upcoming = (await createCycle(asOwner, { startDate: day(10), endDate: day(16) })).data!;
      await createCycle(asOwner, { startDate: day(20), endDate: day(26) });

      expect((await asOwner.cycles({ cycleId: upcoming.id })['start-next'].post()).status).toBe(
        400,
      );
    });
  });

  describe('options', () => {
    it('offers the cycles that have not finished', async () => {
      const { asOwner } = await setup();
      await createCycle(asOwner, { name: 'Current', startDate: day(0), endDate: day(6) });
      await createCycle(asOwner, { name: 'Past', startDate: day(-20), endDate: day(-14) });

      const res = await cycles(asOwner).options.get();
      expect(res.status).toBe(200);
      expect(res.data).toEqual([{ id: expect.any(Number), name: 'Current', status: 'active' }]);
    });

    it('reads under work items, so a role without cycle access can plan an issue', async () => {
      const { asOwner } = await setup();
      await createCycle(asOwner, { name: 'Current' });
      const role = await asOwner
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Issues only', permissions: { work_items: { read: true } } });
      const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

      expect((await cycles(asMember).options.get()).status).toBe(200);
      // The cycles pages stay behind the cycles resource.
      expect((await cycles(asMember).get()).status).toBe(403);
    });

    it('denies a role without work item access', async () => {
      const { asOwner } = await setup();
      const role = await asOwner
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Nothing', permissions: {} });
      const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);
      expect((await cycles(asMember).options.get()).status).toBe(403);
    });
  });

  describe('access', () => {
    it('returns 404 for an unknown project', async () => {
      const { asOwner } = await setup();
      const res = await asOwner
        .projects({ projectKey: 'NOPE' })
        .cycles.post({ name: 'x', startDate: day(0), endDate: day(6) });
      expect(res.status).toBe(404);
    });

    it('denies a non-member on the cycle routes', async () => {
      const { asOwner } = await setup();
      const cycle = (await createCycle(asOwner, {})).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);

      expect(
        (
          await outsider
            .projects({ projectKey: 'MKT' })
            .cycles.post({ name: 'x', startDate: day(0), endDate: day(6) })
        ).status,
      ).toBe(403);
      expect((await outsider.projects({ projectKey: 'MKT' }).cycles.get()).status).toBe(403);
      expect((await outsider.cycles({ cycleId: cycle.id }).get()).status).toBe(403);
      expect((await outsider.cycles({ cycleId: cycle.id }).patch({ name: 'x' })).status).toBe(403);
      expect(
        (await outsider.cycles({ cycleId: cycle.id }).transfer.post({ targetCycleId: null }))
          .status,
      ).toBe(403);
      expect((await outsider.cycles({ cycleId: cycle.id }).finish.post()).status).toBe(403);
      expect((await outsider.cycles({ cycleId: cycle.id })['start-next'].post()).status).toBe(403);
      expect((await outsider.cycles({ cycleId: cycle.id }).delete()).status).toBe(403);
    });
  });
});
