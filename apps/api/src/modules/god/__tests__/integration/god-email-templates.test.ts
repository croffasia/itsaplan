import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { setEmailSettings } from '@repo/auth';
import { setExtraEmailTemplates } from '@repo/mailer';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup, type Actor } from '../helpers';

const text = { subject: 'Hello {actor}', body: '**{actor}** assigned {ref}.', button: 'See it' };

const realFetch = globalThis.fetch;

async function read(god: Actor) {
  const res = await god.api.god['email-templates'].get();
  return res.data!;
}

async function draft(god: Actor, key = 'assigned') {
  const { defaultLayout } = await read(god);
  return { key, locale: 'en' as const, text, layout: defaultLayout };
}

describe('god email templates', () => {
  beforeEach(resetDb);

  afterEach(() => {
    globalThis.fetch = realFetch;
    setExtraEmailTemplates([]);
  });

  it('lists every email with its text in every language', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-templates'].get();

    expect(res.status).toBe(200);
    expect(res.data!.templates.map((template) => template.key)).toEqual([
      'reset',
      'verify',
      'magic',
      'inviteProject',
      'inviteTeam',
      'assigned',
      'mentioned',
      'commented',
      'stateChanged',
      'documentMentioned',
      'documentCommentMentioned',
      'test',
    ]);
    const assigned = res.data!.templates.find((template) => template.key === 'assigned')!;
    expect(assigned).toMatchObject({
      group: 'notifications',
      variables: ['actor', 'ref', 'title'],
      hasLink: true,
      edits: {},
    });
    expect(Object.keys(assigned.defaults)).toHaveLength(13);
    expect(assigned.defaults.ru!.subject).toBe('{ref}: назначена на вас');
    expect(res.data!.layout).toEqual(res.data!.defaultLayout);
    expect(res.data!.canSend).toBe(false);
  });

  it('is closed to a plain user', async () => {
    await setup();
    const user = await addUser({ email: 'member@example.com' });

    expect((await user.api.god['email-templates'].get()).status).toBe(403);
    expect((await user.api.god['email-templates'].put({ edits: {}, layout: null })).status).toBe(
      403,
    );
  });

  it('stores a changed text and layout, and goes back to the built-in ones', async () => {
    const { god } = await setup();
    const layout = { html: '<div>{content}{button}</div>', css: 'div { color: red; }' };

    const saved = await god.api.god['email-templates'].put({
      edits: { assigned: { ru: text } },
      layout,
    });

    expect(saved.status).toBe(200);
    expect(saved.data!.layout).toEqual(layout);
    const after = await read(god);
    expect(after.templates.find((template) => template.key === 'assigned')!.edits).toEqual({
      ru: text,
    });

    await god.api.god['email-templates'].put({ edits: {}, layout: null });

    const reset = await read(god);
    expect(reset.layout).toEqual(reset.defaultLayout);
    expect(reset.templates.find((template) => template.key === 'assigned')!.edits).toEqual({});
  });

  it('refuses an unknown email and an unknown language', async () => {
    const { god } = await setup();
    const put = god.api.god['email-templates'].put;

    const email = await put({ edits: { nothing: { en: text } }, layout: null });
    const language = await put({ edits: { assigned: { xx: text } }, layout: null });

    expect(email.status).toBe(400);
    expect(language.status).toBe(400);
  });

  it('refuses an email with no subject or no text', async () => {
    const { god } = await setup();
    const put = god.api.god['email-templates'].put;

    const subject = await put({
      edits: { assigned: { en: { ...text, subject: ' ' } } },
      layout: null,
    });
    const body = await put({ edits: { assigned: { en: { ...text, body: '' } } }, layout: null });

    expect(subject.status).toBe(400);
    expect(body.status).toBe(400);
  });

  it('refuses a variable the email does not have', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-templates'].put({
      edits: { assigned: { ru: { ...text, body: '{actor} {typo}' } } },
      layout: null,
    });

    expect(res.status).toBe(400);
    expect(res.error?.value).toMatchObject({ error: expect.stringContaining('{typo}') });
  });

  it('takes an email with no button text', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-templates'].put({
      edits: { assigned: { en: { ...text, button: '' } } },
      layout: null,
    });

    expect(res.status).toBe(200);
  });

  it('refuses a layout that leaves out the text or the button', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-templates'].put({
      edits: {},
      layout: { html: '<div>{content}</div>', css: '' },
    });

    expect(res.status).toBe(400);
    expect(res.error!.value).toMatchObject({ error: 'The layout needs {button}' });
  });

  it('refuses a layout with a placeholder nothing fills', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-templates'].put({
      edits: {},
      layout: { html: '<div>{content}{button}{logo}</div>', css: '' },
    });

    expect(res.status).toBe(400);
    expect(res.error!.value).toMatchObject({ error: 'Unknown variables in the layout: {logo}' });
  });

  it('refuses a text over the length limit', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-templates'].put({
      edits: { assigned: { en: { ...text, button: 'x'.repeat(201) } } },
      layout: null,
    });

    expect(res.status).toBe(400);
  });

  it('previews text that is not saved, with sample values and the sender', async () => {
    const { god } = await setup();
    await setEmailSettings({
      resend: { enabled: true, apiKey: 're_test' },
      from: 'noreply@example.test',
    });

    const res = await god.api.god['email-templates'].preview.post(await draft(god));

    expect(res.status).toBe(200);
    expect(res.data!.subject).toBe('Hello Maria Lopez');
    expect(res.data!.from).toBe('noreply@example.test');
    expect(res.data!.text).toContain('Maria Lopez assigned WEB-42.');
    expect(res.data!.text).toEndWith(`${process.env.APP_URL}/acme/WEB/issue/42`);
    expect(res.data!.html).toContain('<strong');
    expect(res.data!.html).toContain('class="button"');
    expect((await read(god)).templates.find((t) => t.key === 'assigned')!.edits).toEqual({});
  });

  it('refuses a preview of an unknown email', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-templates'].preview.post(await draft(god, 'nothing'));

    expect(res.status).toBe(400);
  });

  it('refuses a test until a provider is configured', async () => {
    const { god } = await setup();

    const res = await god.api.god['email-templates'].test.post(await draft(god));

    expect(res.status).toBe(400);
    expect(res.error!.value).toMatchObject({ error: 'Configure an email provider first' });
  });

  it('sends a test of what is on the screen to the instance owner', async () => {
    const { god } = await setup();
    await setEmailSettings({
      resend: { enabled: true, apiKey: 're_test' },
      from: 'noreply@example.test',
    });
    const sent: { to: string[]; subject: string }[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).startsWith('https://api.resend.com/')) return realFetch(input, init);
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ id: 'sent' });
    }) as typeof fetch;

    const res = await god.api.god['email-templates'].test.post(await draft(god));

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ recipient: god.email });
    expect(sent).toMatchObject([{ to: [god.email], subject: 'Hello Maria Lopez' }]);
  });

  it('answers 502 when the provider refuses the test', async () => {
    const { god } = await setup();
    await setEmailSettings({
      resend: { enabled: true, apiKey: 're_test' },
      from: 'noreply@example.test',
    });
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) =>
      String(input).startsWith('https://api.resend.com/')
        ? new Response('no', { status: 401 })
        : realFetch(input, init)) as typeof fetch;

    const res = await god.api.god['email-templates'].test.post(await draft(god));

    expect(res.status).toBe(502);
  });

  describe('an edition with templates of its own', () => {
    const extra = {
      key: 'formReply',
      group: 'forms',
      samples: { title: 'A request' },
      samplePath: '/p/requests/example',
      texts: { en: { subject: 'New reply: {title}', body: '{title}', button: 'Open' } },
    };
    const reply = { subject: 'Ответ: {title}', body: '**{title}**', button: 'Открыть' };

    it('lists them after the core ones, with English in a language they lack', async () => {
      const { god } = await setup();
      setExtraEmailTemplates([extra]);

      const { templates } = await read(god);

      expect(templates.at(-1)).toMatchObject({ key: 'formReply', group: 'forms', hasLink: true });
      expect(templates.at(-1)!.defaults.ru).toEqual(extra.texts.en);
    });

    it('previews and stores them', async () => {
      const { god } = await setup();
      setExtraEmailTemplates([extra]);

      const preview = await god.api.god['email-templates'].preview.post({
        ...(await draft(god, 'formReply')),
        text: extra.texts.en,
      });
      const saved = await god.api.god['email-templates'].put({
        edits: { formReply: { ru: reply } },
        layout: null,
      });

      expect(preview.data!.subject).toBe('New reply: A request');
      expect(saved.status).toBe(200);
    });

    it('keeps what god saved while its templates are gone', async () => {
      const { god } = await setup();
      setExtraEmailTemplates([extra]);
      await god.api.god['email-templates'].put({
        edits: { formReply: { ru: reply } },
        layout: null,
      });

      setExtraEmailTemplates([]);
      await god.api.god['email-templates'].put({ edits: {}, layout: null });
      setExtraEmailTemplates([extra]);

      const { templates } = await read(god);
      expect(templates.at(-1)!.edits).toEqual({ ru: reply });
    });
  });
});
