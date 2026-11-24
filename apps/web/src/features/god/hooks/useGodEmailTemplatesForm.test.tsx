import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import type { EmailTemplatesBody, EmailTemplatesSettings } from '@/lib/api/endpoints/god';
import type { GodEmailTemplatesForm } from './useGodEmailTemplatesForm';

let saved: EmailTemplatesBody[] = [];

const builtIn = { subject: 'Reset', body: 'Use the link', button: 'Set' };
const defaultLayout = { html: '<div>{content}{button}</div>', css: '' };

const settings: EmailTemplatesSettings = {
  templates: [
    {
      key: 'reset',
      group: 'signIn',
      variables: [],
      hasLink: true,
      defaults: { en: builtIn, ru: { ...builtIn, subject: 'Сброс' } },
      edits: { ru: { ...builtIn, subject: 'Сохранено' } },
    },
  ],
  layout: defaultLayout,
  defaultLayout,
  placeholders: [
    { name: 'content', required: true },
    { name: 'button', required: true },
    { name: 'lang', required: false },
  ],
  canSend: true,
};

let dom: JSDOM;
let root: Root;
let form: GodEmailTemplatesForm;
let client: QueryClient;
const replaced = ['window', 'document', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'] as const;
let originals: Map<string, PropertyDescriptor | undefined>;

beforeEach(async () => {
  originals = new Map(replaced.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  dom = new JSDOM('<!doctype html><div id="root"></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    fetch: {
      configurable: true,
      value: async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') saved.push(JSON.parse(String(init.body)));
        return Response.json(settings);
      },
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  Object.defineProperty(window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://api.test', privacyUrl: '', termsUrl: '' },
  });
  saved = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(dom.window.document.querySelector('#root')!);
  const { useGodEmailTemplatesForm } = await import('./useGodEmailTemplatesForm');
  function Probe() {
    form = useGodEmailTemplatesForm(settings);
    return null;
  }
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

const step = (fn: () => void) => act(async () => fn());

describe('useGodEmailTemplatesForm', () => {
  it('starts from what god saved, over the built-in text', () => {
    assert.equal(form.text('reset', 'ru').subject, 'Сохранено');
    assert.equal(form.text('reset', 'en').subject, 'Reset');
    assert.equal(form.isEdited('reset', 'ru'), true);
    assert.equal(form.isEdited('reset', 'en'), false);
    assert.equal(form.dirty, false);
  });

  it('counts a change as an edit until it matches the built-in text again', async () => {
    await step(() => form.setText('reset', 'en', { ...builtIn, subject: 'Changed' }));
    assert.equal(form.isEdited('reset', 'en'), true);
    assert.equal(form.dirty, true);

    await step(() => form.setText('reset', 'en', builtIn));
    assert.equal(form.isEdited('reset', 'en'), false);
    assert.equal(form.dirty, false);
  });

  it('resets one language and leaves the others', async () => {
    await step(() => form.setText('reset', 'en', { ...builtIn, subject: 'Changed' }));
    await step(() => form.resetText('reset', 'ru'));

    assert.equal(form.text('reset', 'ru').subject, 'Сброс');
    assert.equal(form.text('reset', 'en').subject, 'Changed');
  });

  it('finds a text with no subject or no body', async () => {
    assert.equal(form.hasBlankText, false);
    await step(() => form.setText('reset', 'en', { ...builtIn, body: ' ' }));
    assert.equal(form.hasBlankText, true);
  });

  it('finds a variable the email does not have', async () => {
    assert.equal(form.hasUnknownVariables, false);
    await step(() => form.setText('reset', 'en', { ...builtIn, body: '{typo}' }));
    assert.equal(form.hasUnknownVariables, true);
  });

  it('names the required placeholders the layout lost', async () => {
    await step(() => form.setLayout({ html: '<div>{content}</div>', css: '' }));
    assert.deepEqual(form.missingPlaceholders, ['button']);
  });

  it('finds a placeholder nothing fills in the layout', async () => {
    assert.equal(form.hasUnknownVariables, false);
    await step(() => form.setLayout({ html: '{content}{button}{logo}{lang}', css: '' }));
    assert.deepEqual(form.unknownPlaceholders, ['logo']);
    assert.equal(form.hasUnknownVariables, true);
  });

  it('saves the edits of every language, and no layout while it is the built-in one', async () => {
    await step(() => form.setText('reset', 'en', { ...builtIn, subject: 'Changed' }));

    await act(async () => form.save());

    assert.deepEqual(saved[0], {
      edits: {
        reset: { ru: { ...builtIn, subject: 'Сохранено' }, en: { ...builtIn, subject: 'Changed' } },
      },
      layout: null,
    });
  });

  it('saves a changed layout, and goes back to the built-in one', async () => {
    const layout = { html: '{content}{button}', css: 'p { margin: 0; }' };
    await step(() => form.setLayout(layout));
    assert.equal(form.layoutEdited, true);

    await act(async () => form.save());
    assert.deepEqual(saved[0]!.layout, layout);

    await step(() => form.resetLayout());
    assert.equal(form.layoutEdited, false);
  });

  it('gives the draft of what is on the screen, saved or not', async () => {
    const text = { ...builtIn, subject: 'Changed' };
    await step(() => form.setText('reset', 'en', text));

    assert.deepEqual(form.draft('reset', 'en'), {
      key: 'reset',
      locale: 'en',
      text,
      layout: defaultLayout,
    });
  });
});
