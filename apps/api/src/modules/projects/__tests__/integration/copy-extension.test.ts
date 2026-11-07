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

let reads: number[] = [];
let applies: { context: CopySectionContext; data: unknown }[] = [];

// A section that holds the id of the project it was read from, and adds a label to the new
// project inside its transaction, named after how many labels were re-created before it.
function section(overrides: Partial<CopySection> = {}): CopySection {
  return {
    key: 'extra',
    requires: ['labels'],
    template: true,
    read: async (projectId) => {
      reads.push(projectId);
      return { from: projectId };
    },
    apply: async (context, data) => {
      applies.push({ context, data });
      await context.tx
        .insert(label)
        .values({ projectId: context.projectId, name: `extra ${context.maps.label.size}` });
    },
    contents: (data) => [`held from ${(data as { from: number }).from}`],
    ...overrides,
  };
}

// The project SRC with the label "bug".
async function setup(): Promise<{
  api: Api;
  teamId: number;
  workspaceId: number;
  sourceId: number;
}> {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  const source = (await createProject(api, { key: 'SRC', name: 'Source' })).data!;
  await api.projects({ projectKey: 'SRC' }).labels.post({ name: 'bug', color: '#ff0000' });
  return { api, teamId: source.teamId, workspaceId: user.workspaceId!, sourceId: source.id };
}

async function labelNames(api: Api, projectKey: string) {
  return (await api.projects({ projectKey }).get()).data?.labels.map((l) => l.name);
}

describe('copy sections of an extension', () => {
  beforeEach(async () => {
    await resetDb();
    reads = [];
    applies = [];
  });
  afterEach(() => setCopySections());

  it('copies a selected section with what it requires', async () => {
    const { api, sourceId } = await setup();
    setCopySections([section()]);

    const copied = await api
      .projects({ projectKey: 'SRC' })
      .copy.post({ key: 'DST', name: 'Destination', include: { extra: true } });
    expect(copied.status).toBe(201);

    expect(await labelNames(api, 'DST')).toEqual(['bug', 'extra 1']);
    expect(applies).toMatchObject([
      { context: { projectId: copied.data!.id, sameTeam: true }, data: { from: sourceId } },
    ]);
  });

  it('leaves a section out unless it is selected', async () => {
    const { api } = await setup();
    setCopySections([section()]);

    await api
      .projects({ projectKey: 'SRC' })
      .copy.post({ key: 'DST', name: 'Destination', include: { labels: true } });

    expect(await labelNames(api, 'DST')).toEqual(['bug']);
    expect(reads).toHaveLength(0);
    expect(applies).toHaveLength(0);
  });

  it('saves a section into a template and applies it to a project made from it', async () => {
    const { api, teamId, workspaceId, sourceId } = await setup();
    setCopySections([section()]);

    const saved = await api
      .workspaces({ workspaceId })
      ['project-templates'].post({ projectId: sourceId, name: 'Kanban', include: { extra: true } });
    const created = await api
      .teams({ teamId })
      .projects.post({ key: 'NEW', name: 'New', templateId: saved.data!.id });

    expect(reads).toEqual([sourceId]);
    expect(applies).toMatchObject([
      { context: { projectId: created.data!.id, sameTeam: false }, data: { from: sourceId } },
    ]);
    expect(await labelNames(api, 'NEW')).toEqual(['bug', 'extra 1']);
    const detail = await api
      .teams({ teamId })
      ['project-templates']({ templateId: saved.data!.id })
      .get();
    expect(detail.data?.sections).toEqual([{ key: 'extra', items: [`held from ${sourceId}`] }]);
  });

  it('leaves a section a template does not carry out of the template', async () => {
    const { api, workspaceId, sourceId } = await setup();
    setCopySections([section({ template: false })]);

    await api
      .workspaces({ workspaceId })
      ['project-templates'].post({ projectId: sourceId, name: 'Kanban', include: { extra: true } });

    expect(reads).toHaveLength(0);
  });

  it('refuses a key the core or another section uses', () => {
    expect(() => setCopySections([section({ key: 'labels' })])).toThrow();
    expect(() => setCopySections([section(), section()])).toThrow();
  });
});
