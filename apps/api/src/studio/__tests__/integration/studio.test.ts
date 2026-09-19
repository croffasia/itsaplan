import { beforeEach, describe, expect, it } from 'bun:test';
import { api, authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

const TEMPLATE = {
  name: 'Brand announcement',
  layout: 'statement' as const,
  aspect: 'portrait' as const,
  backgroundColor: '#0f172a',
  textColor: '#ffffff',
  accentColor: '#38bdf8',
  fontFamily: 'Inter Variable',
  stylePrompt: 'Editorial photography, warm daylight.',
  imageModel: 'google/gemini-3.1-flash-image',
  textModel: 'openai/gpt-5-mini',
};

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

async function setupTemplate() {
  const { asOwner } = await setupProject();
  const created = await asOwner.projects({ projectKey: 'MKT' }).studio.templates.post(TEMPLATE);
  return { asOwner, templateId: created.data!.id };
}

describe('Studio templates', () => {
  beforeEach(resetDb);

  it('creates, lists, updates and deletes a template', async () => {
    const { asOwner } = await setupProject();

    const created = await asOwner.projects({ projectKey: 'MKT' }).studio.templates.post(TEMPLATE);
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      name: 'Brand announcement',
      layout: 'statement',
      aspect: 'portrait',
      stylePrompt: 'Editorial photography, warm daylight.',
      credentialId: null,
    });

    const list = await asOwner.projects({ projectKey: 'MKT' }).studio.templates.get();
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);

    const publicId = created.data!.id;
    const updated = await asOwner.studio.templates({ publicId }).patch({ accentColor: '#ff0000' });
    expect(updated.data).toMatchObject({ accentColor: '#ff0000' });

    const removed = await asOwner.studio.templates({ publicId }).delete();
    expect(removed.status).toBe(204);
    expect(
      (await asOwner.projects({ projectKey: 'MKT' }).studio.templates.get()).data,
    ).toHaveLength(0);
  });

  it('rejects a name that is empty and a colour that is not a hex value', async () => {
    const { asOwner } = await setupProject();

    const noName = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.templates.post({ ...TEMPLATE, name: '' });
    expect(noName.status).toBe(400);

    const badColor = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.templates.post({ ...TEMPLATE, accentColor: 'blue' });
    expect(badColor.status).toBe(400);
  });

  it('refuses a second template with the same name', async () => {
    const { asOwner } = await setupProject();

    await asOwner.projects({ projectKey: 'MKT' }).studio.templates.post(TEMPLATE);
    const duplicate = await asOwner.projects({ projectKey: 'MKT' }).studio.templates.post(TEMPLATE);
    expect(duplicate.status).toBe(409);
  });

  it('keeps a template that still has posts', async () => {
    const { asOwner, templateId } = await setupTemplate();
    await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: 'Spring launch' });

    const removed = await asOwner.studio.templates({ publicId: templateId }).delete();
    expect(removed.status).toBe(409);
  });
});

describe('Studio posts', () => {
  beforeEach(resetDb);

  it('creates a post with its own vault folder and updates its text', async () => {
    const { asOwner, templateId } = await setupTemplate();

    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: 'Spring launch', topic: 'We open on 3 May.' });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      title: 'Spring launch',
      topic: 'We open on 3 May.',
      templateName: 'Brand announcement',
      folder: 'Spring launch',
      status: 'draft',
      sourceImageId: null,
      renderedImageId: null,
    });

    const publicId = created.data!.id;
    const updated = await asOwner.studio
      .posts({ publicId })
      .patch({ headline: 'We open on 3 May', imagePrompt: 'A florist arranging tulips.' });
    expect(updated.data).toMatchObject({
      headline: 'We open on 3 May',
      imagePrompt: 'A florist arranging tulips.',
    });

    const read = await asOwner.studio.posts({ publicId }).get();
    expect(read.data).toMatchObject({ headline: 'We open on 3 May' });
  });

  it('stores the lead line, the pills and the button label', async () => {
    const { asOwner, templateId } = await setupTemplate();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: 'Our platform' });
    const publicId = created.data!.id;
    expect(created.data).toMatchObject({ lead: '', chips: [], ctaLabel: '' });

    const updated = await asOwner.studio.posts({ publicId }).patch({
      lead: 'Your Rules. Your Money.',
      headline: 'Our Platform.',
      chips: ['Total transparency', 'Real control'],
      ctaLabel: 'Explore AI Support',
    });
    expect(updated.data).toMatchObject({
      lead: 'Your Rules. Your Money.',
      headline: 'Our Platform.',
      chips: ['Total transparency', 'Real control'],
      ctaLabel: 'Explore AI Support',
    });
  });

  it('refuses more than three pills', async () => {
    const { asOwner, templateId } = await setupTemplate();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: 'Our platform' });

    const tooMany = await asOwner.studio
      .posts({ publicId: created.data!.id })
      .patch({ chips: ['one', 'two', 'three', 'four'] });
    expect(tooMany.status).toBe(400);
  });

  it('gives a second post with the same title its own folder', async () => {
    const { asOwner, templateId } = await setupTemplate();

    const first = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: 'Spring launch' });
    const second = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: 'Spring launch' });

    expect(first.data!.folder).toBe('Spring launch');
    expect(second.data!.folder).toBe('Spring launch 2');
  });

  it('rejects an empty title and an unknown template', async () => {
    const { asOwner, templateId } = await setupTemplate();

    const noTitle = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: '' });
    expect(noTitle.status).toBe(400);

    const unknownTemplate = await asOwner.projects({ projectKey: 'MKT' }).studio.posts.post({
      templateId: '00000000-0000-0000-0000-000000000000',
      title: 'Spring launch',
    });
    expect(unknownTemplate.status).toBe(404);
  });

  it('refuses to generate a photo without a prompt', async () => {
    const { asOwner, templateId } = await setupTemplate();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: 'Spring launch' });

    const generated = await asOwner.studio.posts({ publicId: created.data!.id }).image.post();
    expect(generated.status).toBe(400);
  });

  it('refuses to generate without a credential on the template', async () => {
    const { asOwner, templateId } = await setupTemplate();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: 'Spring launch' });
    const publicId = created.data!.id;
    await asOwner.studio.posts({ publicId }).patch({ imagePrompt: 'A florist arranging tulips.' });

    const image = await asOwner.studio.posts({ publicId }).image.post();
    expect(image.status).toBe(400);

    const copy = await asOwner.studio.posts({ publicId }).copy.post();
    expect(copy.status).toBe(400);
  });

  it('deletes a post', async () => {
    const { asOwner, templateId } = await setupTemplate();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: 'Spring launch' });

    const removed = await asOwner.studio.posts({ publicId: created.data!.id }).delete();
    expect(removed.status).toBe(204);
    expect((await asOwner.projects({ projectKey: 'MKT' }).studio.posts.get()).data).toHaveLength(0);
  });
});

describe('Studio access', () => {
  beforeEach(resetDb);

  it('keeps a non-member out of the templates of a project', async () => {
    const { asOwner } = await setupTemplate();
    const outsider = await signUpTestUser();

    const list = await authedApi(outsider.cookie)
      .projects({ projectKey: 'MKT' })
      .studio.templates.get();
    expect(list.status).toBe(403);

    // The owner still reads it.
    expect((await asOwner.projects({ projectKey: 'MKT' }).studio.templates.get()).status).toBe(200);
  });

  it('answers a post of another project with 404, not its contents', async () => {
    const { templateId, asOwner } = await setupTemplate();
    const created = await asOwner
      .projects({ projectKey: 'MKT' })
      .studio.posts.post({ templateId, title: 'Spring launch' });

    const outsider = await signUpTestUser();
    const read = await authedApi(outsider.cookie)
      .studio.posts({ publicId: created.data!.id })
      .get();
    expect(read.status).toBe(403);
  });

  it('needs a session', async () => {
    await setupTemplate();
    const list = await api.projects({ projectKey: 'MKT' }).studio.templates.get();
    expect(list.status).toBe(401);
  });
});
