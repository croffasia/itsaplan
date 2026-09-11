import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole } from '#tests/helpers/roles';

type Client = ReturnType<typeof authedApi>;

async function setupOwnerProject(): Promise<{ api: Client; userId: string }> {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  await api.projects.post({ key: 'MKT', name: 'Marketing' });
  return { api, userId: owner.userId };
}

// Adds a member to project MKT through the invite flow, optionally on a custom role.
async function addMember(owner: Client, opts: { roleId?: number } = {}): Promise<Client> {
  const user = await signUpTestUser();
  const invite = await owner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  if (opts.roleId != null) {
    await owner
      .projects({ projectKey: 'MKT' })
      .members({ userId: user.userId })
      .patch({ role: 'member', roleId: opts.roleId });
  }
  return api;
}

function jobs(api: Client) {
  return api.projects({ projectKey: 'MKT' })['import-jobs'];
}

function entity(api: Client, id: number) {
  return api['import-jobs']({ id });
}

const validBody = {
  baseUrl: 'https://plane.example.com',
  workspaceSlug: 'acme',
  apiToken: 'plane_api_token_123',
  planeProjectId: 'db95831f-b1ff-49e1-91c1-df28cd99bc41',
  planeProjectKey: 'ROOMS',
};

const zeroCounts = { discovered: 0, created: 0 };
const zeroedCounts = {
  issue: zeroCounts,
  comment: zeroCounts,
  label: zeroCounts,
  state: zeroCounts,
  cycle: zeroCounts,
  attachment: zeroCounts,
};

describe('import jobs', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create', () => {
    it('creates a pending job and never returns the credential', async () => {
      const { api } = await setupOwnerProject();

      const res = await jobs(api).post(validBody);
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        source: 'plane',
        phase: 'discover',
        status: 'pending',
        counts: zeroedCounts,
        lastError: null,
      });
      expect(typeof res.data?.id).toBe('number');
      expect(res.data).not.toHaveProperty('baseUrl');
      expect(res.data).not.toHaveProperty('apiToken');
      expect(res.data).not.toHaveProperty('config');
      expect(res.data).not.toHaveProperty('credentialCiphertext');
    });

    it('defaults unmatchedUserPolicy and accepts stateOverrides', async () => {
      const { api } = await setupOwnerProject();

      const res = await jobs(api).post({
        ...validBody,
        unmatchedUserPolicy: 'skip',
        stateOverrides: { 'plane-state-1': 'started' },
      });
      expect(res.status).toBe(201);
      expect(res.data?.status).toBe('pending');
    });

    it('rejects a missing required field', async () => {
      const { api } = await setupOwnerProject();
      const { baseUrl: _baseUrl, ...withoutBaseUrl } = validBody;
      const res = await jobs(api).post(withoutBaseUrl as never);
      expect(res.status).toBe(400);
    });

    it('rejects an empty required field', async () => {
      const { api } = await setupOwnerProject();
      const res = await jobs(api).post({ ...validBody, workspaceSlug: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a malformed baseUrl', async () => {
      const { api } = await setupOwnerProject();
      const res = await jobs(api).post({ ...validBody, baseUrl: 'not a url' });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown unmatchedUserPolicy value', async () => {
      const { api } = await setupOwnerProject();
      const res = await jobs(api).post({ ...validBody, unmatchedUserPolicy: 'bogus' as never });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown stateOverrides category', async () => {
      const { api } = await setupOwnerProject();
      const res = await jobs(api).post({
        ...validBody,
        stateOverrides: { 'plane-state-1': 'bogus' as never },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('list', () => {
    it("lists a project's import jobs, newest first", async () => {
      const { api } = await setupOwnerProject();
      const first = (await jobs(api).post(validBody)).data!;
      const second = (await jobs(api).post({ ...validBody, planeProjectId: 'other-project' }))
        .data!;

      const res = await jobs(api).get();
      expect(res.status).toBe(200);
      expect(res.data?.map((j) => j.id)).toEqual([second.id, first.id]);
    });

    it('returns an empty list for a project with no import jobs', async () => {
      const { api } = await setupOwnerProject();
      const res = await jobs(api).get();
      expect(res.status).toBe(200);
      expect(res.data).toEqual([]);
    });
  });

  describe('get status', () => {
    it('returns the status and progress counts of a job', async () => {
      const { api } = await setupOwnerProject();
      const created = (await jobs(api).post(validBody)).data!;

      const res = await entity(api, created.id).get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        id: created.id,
        phase: 'discover',
        status: 'pending',
        counts: zeroedCounts,
      });
    });

    it('returns 404 for an unknown job id', async () => {
      const { api } = await setupOwnerProject();
      const res = await entity(api, 999999).get();
      expect(res.status).toBe(404);
    });
  });

  describe('pause, resume, cancel', () => {
    it('pauses a pending job and resumes it', async () => {
      const { api } = await setupOwnerProject();
      const created = (await jobs(api).post(validBody)).data!;

      const paused = await entity(api, created.id).pause.post();
      expect(paused.status).toBe(200);
      expect(paused.data?.status).toBe('paused');

      const resumed = await entity(api, created.id).resume.post();
      expect(resumed.status).toBe(200);
      expect(resumed.data?.status).toBe('pending');
    });

    it('rejects pausing an already-paused job', async () => {
      const { api } = await setupOwnerProject();
      const created = (await jobs(api).post(validBody)).data!;
      await entity(api, created.id).pause.post();

      const res = await entity(api, created.id).pause.post();
      expect(res.status).toBe(409);
    });

    it('rejects resuming a job that is not paused', async () => {
      const { api } = await setupOwnerProject();
      const created = (await jobs(api).post(validBody)).data!;

      const res = await entity(api, created.id).resume.post();
      expect(res.status).toBe(409);
    });

    it('cancels a pending job', async () => {
      const { api } = await setupOwnerProject();
      const created = (await jobs(api).post(validBody)).data!;

      const res = await entity(api, created.id).cancel.post();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ status: 'failed', lastError: 'Canceled' });
    });

    it('rejects canceling an already-canceled (failed) job', async () => {
      const { api } = await setupOwnerProject();
      const created = (await jobs(api).post(validBody)).data!;
      await entity(api, created.id).cancel.post();

      const res = await entity(api, created.id).cancel.post();
      expect(res.status).toBe(409);
    });

    it('returns 404 pausing, resuming, or canceling an unknown job', async () => {
      const { api } = await setupOwnerProject();
      expect((await entity(api, 999999).pause.post()).status).toBe(404);
      expect((await entity(api, 999999).resume.post()).status).toBe(404);
      expect((await entity(api, 999999).cancel.post()).status).toBe(404);
    });
  });

  describe('test connection', () => {
    it('rejects a missing required field', async () => {
      const { api } = await setupOwnerProject();
      const res = await jobs(api)['test-connection'].post({
        baseUrl: validBody.baseUrl,
        workspaceSlug: validBody.workspaceSlug,
      } as never);
      expect(res.status).toBe(400);
    });

    it('rejects a base URL the SSRF guard refuses', async () => {
      const { api } = await setupOwnerProject();
      const res = await jobs(api)['test-connection'].post({
        baseUrl: 'http://localhost:9999',
        workspaceSlug: validBody.workspaceSlug,
        apiToken: validBody.apiToken,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('access', () => {
    it('returns 404 for an unknown project', async () => {
      const { api } = await setupOwnerProject();
      const res = await api.projects({ projectKey: 'NOPE' })['import-jobs'].get();
      expect(res.status).toBe(404);
    });

    it('denies a non-member on project-scoped and entity routes', async () => {
      const { api } = await setupOwnerProject();
      const created = (await jobs(api).post(validBody)).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);

      expect((await jobs(outsider).get()).status).toBe(403);
      expect((await jobs(outsider).post(validBody)).status).toBe(403);
      expect((await entity(outsider, created.id).get()).status).toBe(403);
      expect((await entity(outsider, created.id).pause.post()).status).toBe(403);
    });

    it('denies a member whose role lacks the import_jobs permission', async () => {
      const { api } = await setupOwnerProject();
      const created = (await jobs(api).post(validBody)).data!;
      const member = await addMember(api);

      expect((await jobs(member).get()).status).toBe(403);
      expect((await jobs(member).post(validBody)).status).toBe(403);
      expect((await entity(member, created.id).get()).status).toBe(403);
      expect((await entity(member, created.id).pause.post()).status).toBe(403);
    });

    it('allows a member whose role grants the import_jobs permission', async () => {
      const { api } = await setupOwnerProject();
      const role = await createRole(api, 'MKT', {
        name: 'Importer',
        permissions: { import_jobs: { create: true, read: true, edit: true } },
      });
      const member = await addMember(api, { roleId: role.data!.id });

      const created = await jobs(member).post(validBody);
      expect(created.status).toBe(201);

      const list = await jobs(member).get();
      expect(list.status).toBe(200);

      const paused = await entity(member, created.data!.id).pause.post();
      expect(paused.status).toBe(200);
    });

    it('always allows the project owner, regardless of role', async () => {
      const { api } = await setupOwnerProject();
      const res = await jobs(api).post(validBody);
      expect(res.status).toBe(201);
    });
  });
});
