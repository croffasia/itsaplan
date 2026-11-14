import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import common from '../../../../messages/en/common.json';
import teams from '../../../../messages/en/teams.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'SVGElement',
  'Event',
  'CustomEvent',
  'FocusEvent',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'MutationObserver',
  'ResizeObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;

async function render() {
  const { default: NewTeamModal } = await import('./NewTeamModal');
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ common, teams }} timeZone="UTC">
          <NewTeamModal workspaceId={1} onClose={() => {}} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

const nameInput = () => document.querySelector<HTMLInputElement>('input[placeholder="Team name"]')!;
const slugInput = () => document.querySelector<HTMLInputElement>('#new-team-slug')!;
const submit = () =>
  [...document.querySelectorAll('button')].find((button) => button.textContent === 'Create team')!;

async function typeInto(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

before(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/',
    pretendToBeVisual: true,
  });
  for (const name of replacedGlobals) {
    if (name in dom.window) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
    }
  }
  Object.defineProperties(globalThis, {
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    ResizeObserver: {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    },
    requestAnimationFrame: {
      configurable: true,
      value: (cb: FrameRequestCallback) => setTimeout(cb, 0),
    },
    cancelAnimationFrame: { configurable: true, value: (id: number) => clearTimeout(id) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  dom.window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => true,
  });
  Object.defineProperty(dom.window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://api.test', privacyUrl: '', termsUrl: '' },
  });
});

beforeEach(async () => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
});

after(() => {
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('NewTeamModal', () => {
  it('enables create when only the URL is filled', async () => {
    await render();
    assert.equal(submit().disabled, true);

    await typeInto(slugInput(), 'acme');

    assert.equal(slugInput().value, 'acme');
    assert.equal(nameInput().value, 'Acme');
    assert.equal(submit().disabled, false);
  });

  it('accepts the leading slash shown in the example', async () => {
    await render();

    await typeInto(slugInput(), '/acme');

    assert.equal(slugInput().value, 'acme');
    assert.equal(submit().disabled, false);
  });

  it('still suggests the URL from the name', async () => {
    await render();

    await typeInto(nameInput(), 'Acme Design');

    assert.equal(slugInput().value, 'acme-design');
    assert.equal(submit().disabled, false);
  });
});
