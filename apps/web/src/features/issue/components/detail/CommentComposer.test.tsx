import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
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
      value: async (input: RequestInfo | URL) => {
        const url = String(input);
        requested.push(url);
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

describe('CommentComposer', () => {
  it('offers in the @ menu who the api says a comment on the project reaches', async () => {
    const { default: CommentComposer } = await import('./CommentComposer');
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <NextIntlClientProvider locale="en" messages={{ common, issue }} timeZone="UTC">
            <CommentComposer
              issueId={1}
              projectKey="acme.TEST"
              authorName="Ana"
              authorImage={null}
            />
          </NextIntlClientProvider>
        </QueryClientProvider>,
      );
    });

    const textarea = document.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
        textarea,
        '@',
      );
      textarea.setSelectionRange(1, 1);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    assert.ok(
      requested.some((url) => url.endsWith('/projects/acme.TEST/mention-candidates?place=comment')),
    );
    const offered = [...document.querySelectorAll('button span')]
      .map((span) => span.textContent!)
      .filter((text) => text.startsWith('@'));
    assert.deepEqual(offered, ['@ana', '@triage']);
  });
});
