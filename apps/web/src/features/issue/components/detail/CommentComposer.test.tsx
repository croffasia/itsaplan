import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { Assignee } from '@/lib/api/endpoints/projects';
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

function assignee(over: Partial<Assignee>): Assignee {
  return {
    userId: over.username ?? 'u',
    name: over.username ?? 'u',
    email: '',
    username: null,
    image: null,
    kind: 'member',
    agentKind: null,
    restrictedToUserId: null,
    respondsToMention: null,
    canReadWorkItems: true,
    ...over,
  };
}

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

beforeEach(async () => {
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
    fetch: { configurable: true, value: async () => Response.json(null) },
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
  it('leaves an agent that does not answer mentions out of the @ menu', async () => {
    const { default: CommentComposer } = await import('./CommentComposer');
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <NextIntlClientProvider locale="en" messages={{ common, issue }} timeZone="UTC">
            <CommentComposer
              issueId={1}
              assignees={[
                assignee({ username: 'ana' }),
                assignee({ username: 'triage', kind: 'agent', respondsToMention: true }),
                assignee({ username: 'cleanup', kind: 'agent', respondsToMention: false }),
              ]}
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

    const offered = [...document.querySelectorAll('li button span')]
      .map((span) => span.textContent!)
      .filter((text) => text.startsWith('@'));
    assert.deepEqual(offered, ['@ana', '@triage']);
  });
});
