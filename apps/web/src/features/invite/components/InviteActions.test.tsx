import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { qk } from '@/services/queryKeys';
import messages from '../../../../messages/en/invite.json';
import InviteActions from './InviteActions';

const token = '00000000-0000-4000-8000-000000000001';
const keys = [qk.projects, qk.teams, qk.workspaces, qk.receivedInvites];
const globals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
let originals: Map<string, PropertyDescriptor | undefined>;
let dom: JSDOM;
let root: Root;
let client: QueryClient;
let navigated: string[];
let membershipAtNavigation: unknown[];
let status: number;

beforeEach(async () => {
  originals = new Map(
    globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/invite/' + token,
  });
  status = 200;
  navigated = [];
  membershipAtNavigation = [];
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
    fetch: {
      configurable: true,
      value: async (input: string | URL | Request) => {
        if (status !== 200) return Response.json({ error: 'Invitation unavailable' }, { status });
        if (String(input).endsWith('/reject')) return new Response(null, { status: 204 });
        return Response.json({
          teamName: 'Example',
          teamRef: '1.example',
          projectKey: null,
          projectName: null,
          role: null,
        });
      },
    },
  });
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false, gcTime: Infinity } },
  });
  for (const key of keys) client.setQueryData(key, []);
  client.setQueryData(['invite', token], { status: 'pending' });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  const router = {
    push: (path: string) => {
      membershipAtNavigation = [qk.teams, qk.projects, qk.workspaces].map((key) =>
        client.getQueryData(key),
      );
      navigated.push(path);
    },
    refresh() {},
    replace() {},
    back() {},
    forward() {},
    prefetch() {},
  };
  await act(async () =>
    root.render(
      <AppRouterContext.Provider value={router as never}>
        <QueryClientProvider client={client}>
          <NextIntlClientProvider locale="en" messages={{ invite: messages }} timeZone="UTC">
            <InviteActions token={token} projectKey={null} />
          </NextIntlClientProvider>
        </QueryClientProvider>
      </AppRouterContext.Provider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find((one) => one.textContent === label);
  assert.ok(button);
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('InviteActions membership cache', () => {
  it('invalidates teams, projects, workspaces and received invites before returning home', async () => {
    await click(messages.accept);
    assert.deepEqual(navigated, ['/']);
    assert.deepEqual(
      keys.map((key) => client.getQueryState(key)?.isInvalidated),
      [true, true, true, true],
    );
  });

  it('refreshes inactive membership lists before navigation', async () => {
    let joined = false;
    const membershipKeys = [qk.teams, qk.projects, qk.workspaces];
    for (const queryKey of membershipKeys) {
      await client.fetchQuery({
        queryKey,
        queryFn: async () => (joined ? ['new membership'] : []),
        staleTime: 0,
      });
      assert.equal(client.getQueryCache().find({ queryKey })?.getObserversCount(), 0);
    }
    joined = true;

    await click(messages.accept);

    assert.deepEqual(navigated, ['/']);
    assert.deepEqual(membershipAtNavigation, [
      ['new membership'],
      ['new membership'],
      ['new membership'],
    ]);
  });

  it('invalidates the received list on decline without granting membership', async () => {
    await click(messages.decline);
    assert.equal(client.getQueryState(qk.receivedInvites)?.isInvalidated, true);
    assert.equal(client.getQueryState(['invite', token])?.isInvalidated, true);
    assert.equal(client.getQueryState(qk.teams)?.isInvalidated, false);
    assert.deepEqual(navigated, []);
  });

  it('preserves membership caches and stays on the invite when acceptance is refused', async () => {
    status = 409;
    await click(messages.accept);
    assert.deepEqual(navigated, []);
    assert.deepEqual(
      keys.map((key) => client.getQueryState(key)?.isInvalidated),
      [false, false, false, false],
    );
    assert.ok(document.body.textContent?.includes('Invitation unavailable'));
  });
});
