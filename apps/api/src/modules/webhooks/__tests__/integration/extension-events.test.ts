import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { emitExtensionWebhookEvent } from '../../emit';
import { setWebhookEvents } from '../../service';

// An event an extension adds is listed, subscribed to and sent as the core's are, and a
// webhook keeps it once it is taken away.

const THING_DONE = { event: 'thing.done', action: 'update', type: 'Thing' } as const;

const hooks = (api: Api) => api.projects({ projectKey: 'MKT' }).webhooks;

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { asOwner, projectId: project.data!.id };
}

async function sent(api: Api, webhookId: number) {
  return (await api.webhooks({ webhookId }).deliveries.get()).data!.items;
}

describe('webhook events an extension adds', () => {
  beforeEach(async () => {
    await resetDb();
    setWebhookEvents([THING_DONE]);
  });
  afterEach(() => setWebhookEvents());

  it('lists them after the core’s and sends them as the core’s', async () => {
    const { asOwner, projectId } = await setup();
    const types = (await hooks(asOwner)['event-types'].get()).data!;
    expect(types.at(-1)).toBe('thing.done');
    expect(types).toContain('agent_run.finished');

    const created = await hooks(asOwner).post({
      url: 'https://example.com/hook',
      events: ['thing.done'],
    });
    expect(created.status).toBe(201);
    await emitExtensionWebhookEvent(projectId, 'thing.done', async () => [{ id: 7 }], null);
    const [delivery] = await sent(asOwner, created.data!.id);
    expect(delivery).toMatchObject({ eventType: 'thing.done' });
    expect(delivery.payload).toMatchObject({
      action: 'update',
      type: 'Thing',
      event: 'thing.done',
      data: { id: 7 },
    });
  });

  it('keeps one taken away on the webhooks that have it, and sends none of it', async () => {
    const { asOwner, projectId } = await setup();
    const created = await hooks(asOwner).post({
      url: 'https://example.com/hook',
      events: ['thing.done', 'issue.created'],
    });
    setWebhookEvents();

    const kept = await asOwner
      .webhooks({ webhookId: created.data!.id })
      .patch({ events: ['thing.done', 'issue.created'] });
    expect(kept.data?.events).toEqual(['thing.done', 'issue.created']);
    const added = await hooks(asOwner).post({
      url: 'https://example.com/b',
      events: ['thing.done'],
    });
    expect(added.status).toBe(400);
    await emitExtensionWebhookEvent(projectId, 'thing.done', async () => [{ id: 7 }], null);
    expect(await sent(asOwner, created.data!.id)).toEqual([]);
  });

  it('takes no name the core has', () => {
    expect(() => setWebhookEvents([{ ...THING_DONE, event: 'issue.created' }])).toThrow('taken');
  });
});
