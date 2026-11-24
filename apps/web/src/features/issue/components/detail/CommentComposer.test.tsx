import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, type ComponentProps } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import common from '../../../../../messages/en/common.json';
import issue from '../../../../../messages/en/issue.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'HTMLElement',
  'HTMLTextAreaElement',
  'Event',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

// The candidates the api returns for a comment on the project's issues.
const candidates = [
  { userId: 'u-ana', name: 'Ana', username: 'ana', kind: 'member' },
  { userId: 'u-triage', name: 'Triage', username: 'triage', kind: 'agent' },
];
let requested: string[];

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

beforeEach(async () => {
  requested = [];
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/' });
  for (const name of replacedGlobals) {
    if (name in dom.window) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
    }
  }
  Object.defineProperties(globalThis, {
    fetch: {
      configurable: true,
      value: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        requested.push(init?.method === 'POST' ? `POST ${url}` : url);
        return Response.json(url.includes('/mention-candidates') ? candidates : null);
      },
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  Object.defineProperty(window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://api.test', privacyUrl: '', termsUrl: '' },
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  // Better Auth's stores dispose their browser listeners one second after unmount.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

type ComposerProps = Partial<ComponentProps<(typeof import('./CommentComposer'))['default']>>;

// Renders the box, or nothing for `null`, which unmounts it as closing the panel does.
async function show(props: ComposerProps | null) {
  const { default: CommentComposer } = await import('./CommentComposer');
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ common, issue }} timeZone="UTC">
          {props && (
            <CommentComposer
              issueId={1}
              projectKey="acme.TEST"
              userId="u-ana"
              authorName="Ana"
              authorImage={null}
              {...props}
            />
          )}
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
  });
}

async function type(text: string) {
  const textarea = document.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      textarea,
      text,
    );
    textarea.setSelectionRange(text.length, text.length);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent === label)!;
  await act(async () => button.click());
}

const boxText = () => document.querySelector('textarea')!.value;

describe('CommentComposer', () => {
  it('offers in the @ menu who the api says a comment on the project reaches', async () => {
    await show({});
    await type('@');

    assert.ok(
      requested.some((url) => url.endsWith('/projects/acme.TEST/mention-candidates?place=comment')),
    );
    const offered = [...document.querySelectorAll('button span')]
      .map((span) => span.textContent!)
      .filter((text) => text.startsWith('@'));
    assert.deepEqual(offered, ['@ana', '@triage']);
  });
});

describe('CommentComposer drafts', () => {
  it('brings back unsent text after the box is closed, until the reply is cancelled', async () => {
    const reply = { replyToId: 7, onClose: () => {} };
    await show(reply);
    await type('half a reply');
    await show(null);
    await show(reply);
    assert.equal(boxText(), 'half a reply');

    await click('Cancel');
    await show(null);
    await show(reply);
    assert.equal(boxText(), '');
  });

  it('keeps a draft per issue when the same box switches issues', async () => {
    await show({ issueId: 1 });
    await type('about issue one');
    await show({ issueId: 2 });
    assert.equal(boxText(), '');
    await show({ issueId: 1 });
    assert.equal(boxText(), 'about issue one');
  });

  it('drops the draft once the comment is posted', async () => {
    await show({});
    await type('posted text');
    await click('Comment');
    assert.ok(
      requested.some((url) => url.startsWith('POST ') && url.endsWith('/issues/1/comments')),
    );
    await show(null);
    await show({});
    assert.equal(boxText(), '');
  });

  it('ignores a draft older than 30 days', async () => {
    localStorage.setItem(
      'itsaplan:comment-draft:u-ana:1:new',
      JSON.stringify({ body: 'old text', savedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 }),
    );
    await show({});
    assert.equal(boxText(), '');
  });
});
