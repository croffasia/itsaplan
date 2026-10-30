import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { label } from '@repo/db';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import {
  setCopySections,
  type CopySection,
  type CopySectionContext,
} from '#modules/projects/copy-extension';

let calls: CopySectionContext[] = [];

// A section that records each run and adds a label to the copy inside its transaction,
// named after how many labels the copy re-created before it.
function section(overrides: Partial<CopySection> = {}): CopySection {
  return {
    key: 'extra',
    requires: ['labels'],
    template: true,
    copy: async (context) => {
      calls.push(context);
      await context.tx
        .insert(label)
        .values({ projectId: context.projectId, name: `extra ${context.maps.label.size}` });
    },
    contents: async (projectId) => [`held by ${projectId}`],
    ...overrides,
  };
}

// The project SRC with the label "bug".
async function setup(): Promise<{ api: Api; teamId: number; sourceId: number }> {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  const source = (await createProject(api, { key: 'SRC', name: 'Source' })).data!;
  await api.projects({ projectKey: 'SRC' }).labels.post({ name: 'bug', color: '#ff0000' });
  return { api, teamId: source.teamId, sourceId: source.id };
}

async function labelNames(api: Api, projectKey: string) {
  return (await api.projects({ projectKey }).get()).data?.labels.map((l) => l.name);
}

describe('copy sections of an extension', () => {
  beforeEach(async () => {
    await resetDb();
    calls = [];
  });
  afterEach(() => setCopySections());

  it('copies a selected section with what it requires', async () => {
    const { api } = await setup();
    setCopySections([section()]);

    const copied = await api
      .projects({ projectKey: 'SRC' })
      .copy.post({ key: 'DST', name: 'Destination', include: { extra: true } });
    expect(copied.status).toBe(201);

    expect(await labelNames(api, 'DST')).toEqual(['bug', 'extra 1']);
    expect(calls).toMatchObject([{ template: false, sameTeam: true }]);
  });

  it('leaves a section out unless it is selected', async () => {
    const { api } = await setup();
    setCopySections([section()]);

    await api
      .projects({ projectKey: 'SRC' })
      .copy.post({ key: 'DST', name: 'Destination', include: { labels: true } });

    expect(await labelNames(api, 'DST')).toEqual(['bug']);
    expect(calls).toHaveLength(0);
  });

  it('saves a section into a template and copies it into a project made from it', async () => {
    const { api, teamId, sourceId } = await setup();
    setCopySections([section()]);

    const saved = await api
      .teams({ teamId })
      ['project-templates'].post({ projectId: sourceId, name: 'Kanban', include: { extra: true } });
    await api
      .teams({ teamId })
      .projects.post({ key: 'NEW', name: 'New', templateId: saved.data!.id });

    expect(calls.map((call) => call.template)).toEqual([true, false]);
    const detail = await api
      .teams({ teamId })
      ['project-templates']({ templateId: saved.data!.id })
      .get();
    expect(detail.data?.sections).toEqual([{ key: 'extra', items: [`held by ${saved.data!.id}`] }]);
  });

  it('leaves a section a template does not carry out of the template', async () => {
    const { api, teamId, sourceId } = await setup();
    setCopySections([section({ template: false })]);

    await api
      .teams({ teamId })
      ['project-templates'].post({ projectId: sourceId, name: 'Kanban', include: { extra: true } });

    expect(calls).toHaveLength(0);
  });

  it('refuses a key the core or another section uses', () => {
    expect(() => setCopySections([section({ key: 'labels' })])).toThrow();
    expect(() => setCopySections([section(), section()])).toThrow();
  });
});
