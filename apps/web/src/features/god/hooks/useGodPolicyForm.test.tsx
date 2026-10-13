import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import type { InstanceAuthSettings, InstanceAuthSettingsPatch } from '@/lib/api/endpoints/god';

// The invite lifetime is typed into the form as text: only a whole number of days, 0 or
// more, can be saved, and it is saved with the rest of the page.
const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let saved: InstanceAuthSettingsPatch[] = [];
let form: import('./useGodPolicyForm').GodPolicyForm;
let queryClient: QueryClient;
let originalFetch: typeof fetch;

const settings = {
  registration: 'invite',
  requireEmailVerification: false,
  magicLink: false,
  emailPassword: false,
  trustProviderEmails: false,
  personalWorkspaces: true,
  inviteTtlDays: 7,
  hasEmailProvider: true,
  hasSsoProvider: true,
} satisfies InstanceAuthSettings;

async function render() {
  const { useGodPolicyForm } = await import('./useGodPolicyForm');
  function Probe() {
    form = useGodPolicyForm(settings);
    return null;
  }
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
}

beforeEach(async () => {
  originals = new Map(
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
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  });
  dom.window.__ITSAPLAN_ENV__ = { apiUrl: 'http://api.test', privacyUrl: '', termsUrl: '' };
  saved = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/god/auth-settings' && init?.method === 'PUT') {
      const patch = JSON.parse(String(init.body)) as InstanceAuthSettingsPatch;
      saved.push(patch);
      return Response.json({ ...settings, ...patch });
    }
    return Response.json(settings);
  }) as typeof fetch;
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  // React Query notifies on a timer; let it run while this window still exists.
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));
  queryClient.clear();
  globalThis.fetch = originalFetch;
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useGodPolicyForm invite lifetime', () => {
  it('starts clean on the stored value', async () => {
    await render();

    assert.equal(form.inviteTtlDays, '7');
    assert.equal(form.inviteTtlDaysValid, true);
    assert.equal(form.dirty, false);
  });

  it('refuses a value that is not a whole number of days', async () => {
    await render();

    for (const value of ['2.5', '-1', '', 'abc', '3651']) {
      await act(async () => form.setInviteTtlDays(value));
      assert.equal(form.inviteTtlDaysValid, false, value);
    }
  });

  it('saves a new lifetime as a number along with the rest of the page', async () => {
    await render();

    await act(async () => form.setInviteTtlDays('3'));
    assert.equal(form.dirty, true);
    await act(async () => form.save());

    assert.equal(saved.length, 1);
    assert.equal(saved[0].inviteTtlDays, 3);
  });
});
