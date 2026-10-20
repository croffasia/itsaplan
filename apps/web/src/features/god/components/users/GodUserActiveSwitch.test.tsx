import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { InstanceUser } from '@/lib/api/endpoints/god';
import god from '../../../../../messages/en/god.json';
import common from '../../../../../messages/en/common.json';

// Turning an account off signs the person out at once, so it asks first; turning it on
// does not. An account god cannot switch shows its state, locked.

let dom: JSDOM;
let root: Root;
let queryClient: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let originalFetch: typeof fetch;
let calls: { method: string; path: string }[];

const wait = (ms = 20) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

const person = (overrides: Partial<InstanceUser> = {}) =>
  ({
    id: 'u1',
    email: 'ada@example.test',
    active: true,
    activeLock: null,
    ...overrides,
  }) as InstanceUser;

async function render(user: InstanceUser) {
  const { default: GodUserActiveSwitch } = await import('./GodUserActiveSwitch');
  const { TooltipProvider } = await import('@/components/ui/tooltip');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ god, common }} timeZone="UTC">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <GodUserActiveSwitch user={user} />
          </TooltipProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>,
    ),
  );
  await wait();
}

const theSwitch = () => document.querySelector<HTMLButtonElement>('button[role="switch"]');
const dialog = () => document.querySelector('[role="alertdialog"], [role="dialog"]');

function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(
    (element) => element.textContent?.trim() === label,
  );
  assert.ok(result, `Missing button: ${label}`);
  return result;
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'https://planner.test/god/users',
    pretendToBeVisual: true,
  });
  dom.window.__ITSAPLAN_ENV__ = { apiUrl: 'http://api.test', privacyUrl: '', termsUrl: '' };
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLFormElement: dom.window.HTMLFormElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    CustomEvent: dom.window.CustomEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  originalFetch = globalThis.fetch;
  calls = [];
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    calls.push({ method: init?.method ?? 'GET', path: url.pathname });
    return Response.json({ ...person(), active: url.pathname.endsWith('/reactivate') });
  }) as typeof fetch;
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
});

afterEach(async () => {
  await act(() => root.unmount());
  await wait(5);
  queryClient.clear();
  globalThis.fetch = originalFetch;
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const switchCalls = () => calls.filter((call) => /\/(de|re)activate$/.test(call.path));

describe('GodUserActiveSwitch', () => {
  it('asks before turning an account off, and only then deactivates it', async () => {
    await render(person());

    await click(theSwitch()!);
    assert.deepEqual(switchCalls(), []);
    assert.ok(dialog());
    assert.ok(document.body.textContent?.includes(god.users.deactivateBody));

    await click(button(god.users.deactivateConfirm));
    assert.deepEqual(switchCalls(), [{ method: 'POST', path: '/god/users/u1/deactivate' }]);
  });

  it('turns an account back on without asking', async () => {
    await render(person({ active: false }));
    // The switch role announces on or off; the label names the account only.
    assert.equal(theSwitch()!.getAttribute('aria-label'), 'Account active: ada@example.test');
    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'false');

    await click(theSwitch()!);

    assert.equal(dialog(), null);
    assert.deepEqual(switchCalls(), [{ method: 'POST', path: '/god/users/u1/reactivate' }]);
  });

  it('shows the state of an account god cannot switch, not a disabled switch', async () => {
    await render(person({ activeLock: 'scim' }));
    assert.equal(theSwitch(), null);
    assert.ok(document.body.textContent?.includes(god.users.activeState.on));

    await render(person({ active: false, activeLock: 'owner' }));
    assert.equal(theSwitch(), null);
    assert.ok(document.body.textContent?.includes(god.users.activeState.off));
    assert.deepEqual(switchCalls(), []);
  });
});
