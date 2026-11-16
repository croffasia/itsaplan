import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import common from '../../../../messages/en/common.json';
import teams from '../../../../messages/en/teams.json';

// What the dialog reads from the browser.
const fromWindow = [
  'document',
  'navigator',
  'HTMLElement',
  'MutationObserver',
  'Event',
  'CustomEvent',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const;
const globals = ['window', ...fromWindow, 'fetch', 'IS_REACT_ACT_ENVIRONMENT'] as const;
let originals: Map<string, PropertyDescriptor | undefined>;
let dom: JSDOM;
let root: Root;
let posted: unknown[];

beforeEach(() => {
  originals = new Map(
    globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/',
    pretendToBeVisual: true,
  });
  Object.assign(dom.window, { __ITSAPLAN_ENV__: { apiUrl: 'http://api.test' } });
  posted = [];
  for (const name of fromWindow) {
    const value = dom.window[name];
    // Functions such as getComputedStyle need the window as `this`; classes stay as they are.
    const isMethod = typeof value === 'function' && /^[a-z]/.test(name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: isMethod ? (value as (...args: unknown[]) => unknown).bind(dom.window) : value,
    });
  }
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
    fetch: {
      configurable: true,
      value: async (_input: string | URL | Request, init?: RequestInit) => {
        posted.push(JSON.parse(String(init?.body)));
        return Response.json({ id: 7, name: 'Acme Design', slug: 'acme-design' });
      },
    },
  });
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

async function renderModal() {
  const { default: NewTeamModal } = await import('./NewTeamModal');
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  const client = new QueryClient();
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ common, teams }} timeZone="UTC">
          <NewTeamModal workspaceId={1} onClose={() => {}} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
  });
}

async function type(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!;
  await act(async () => {
    setValue.set!.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}

async function clickCreate() {
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === teams.create.submit,
  )!;
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

it('asks for the name when only the URL is filled', async () => {
  await renderModal();
  assert.ok(document.body.textContent?.includes('example.test/'));

  await type('new-team-slug', 'acme');
  await clickCreate();

  assert.ok(document.body.textContent?.includes(teams.create.nameRequired));
  assert.deepEqual(posted, []);
});

it('creates the team with the URL made from the name', async () => {
  await renderModal();

  await type('new-team-name', 'Acme Design');
  await clickCreate();

  assert.deepEqual(posted, [{ name: 'Acme Design', slug: 'acme-design', workspaceId: 1 }]);
});
