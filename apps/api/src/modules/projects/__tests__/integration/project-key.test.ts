import { describe, it, expect, beforeEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db, project } from '@repo/db';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// A key stored before the key pattern existed may start with a digit. Such a project
// can take a valid key; a valid key does not change.

async function ownerWithProject(key: string) {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  const created = (await api.projects.post({ key: 'TMP', name: 'Trader' })).data!;
  await db.update(project).set({ key }).where(eq(project.id, created.id));
  return { api, created };
}

describe('project key rename', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renames a key that starts with a digit, once', async () => {
    const { api, created } = await ownerWithProject('7XTR');

    const renamed = await api
      .projects({ projectKey: `${created.teamId}.7XTR` })
      .patch({ key: 'XTR' });
    expect(renamed.status).toBe(200);
    expect(renamed.data).toMatchObject({ key: 'XTR', ref: `${created.teamId}.XTR` });

    const again = await api.projects({ projectKey: `${created.teamId}.XTR` }).patch({ key: 'ABC' });
    expect(again.status).toBe(400);
  });

  it('renames through the team route', async () => {
    const { api, created } = await ownerWithProject('7XTR');

    const renamed = await api
      .teams({ teamId: created.teamId })
      .projects({ projectId: created.id })
      .patch({ key: 'XTR' });
    expect(renamed.data).toMatchObject({ key: 'XTR' });
  });

  it('accepts the unchanged valid key', async () => {
    const user = await signUpTestUser();
    const api = authedApi(user.cookie);
    const created = (await api.projects.post({ key: 'MKT', name: 'Marketing' })).data!;

    const res = await api.projects({ projectKey: created.ref }).patch({ key: 'MKT', name: 'Ads' });
    expect(res.data).toMatchObject({ key: 'MKT', name: 'Ads' });
  });

  it('refuses a key another project of the team has', async () => {
    const { api, created } = await ownerWithProject('7XTR');
    await api.projects.post({ key: 'XTR', name: 'Other' });

    const res = await api.projects({ projectKey: `${created.teamId}.7XTR` }).patch({ key: 'XTR' });
    expect(res.status).toBe(409);
  });
});
