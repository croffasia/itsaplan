import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { qk } from '@/services/queryKeys';
import { clearAccountQueries } from './session-scope';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
let dom: JSDOM;
let root: Root;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/login' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  const element = document.querySelector('#root');
  assert.ok(element);
  root = createRoot(element);
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('clearAccountQueries', () => {
  // After a sign-out, the sign-in screen is mounted and waiting on the instance's
  // configuration when the user change clears the cache.
  it('keeps the sign-in configuration a mounted screen is still waiting on', async () => {
    const client = new QueryClient();
    let answer!: (config: { emailPassword: boolean }) => void;
    function SignIn() {
      const { data } = useQuery({
        queryKey: qk.authConfig,
        queryFn: () => new Promise<{ emailPassword: boolean }>((resolve) => (answer = resolve)),
      });
      return <p>{data ? `emailPassword=${data.emailPassword}` : 'no configuration'}</p>;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <SignIn />
        </QueryClientProvider>,
      ),
    );

    await act(async () => clearAccountQueries(client));
    // React Query notifies its observers on a timer, not in the same tick.
    await act(async () => {
      answer({ emailPassword: false });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    assert.equal(document.querySelector('p')?.textContent, 'emailPassword=false');
  });

  it("drops the previous account's data", () => {
    const client = new QueryClient();
    client.setQueryData(qk.authConfig, { emailPassword: false });
    client.setQueryData(qk.teams, [{ id: 1 }]);
    client.getMutationCache().build(client, { mutationKey: ['watch'] });

    clearAccountQueries(client);

    assert.deepEqual(client.getQueryData(qk.authConfig), { emailPassword: false });
    assert.equal(client.getQueryData(qk.teams), undefined);
    assert.equal(client.getMutationCache().getAll().length, 0);
  });
});
