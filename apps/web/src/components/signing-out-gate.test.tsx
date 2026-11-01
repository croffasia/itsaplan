import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM, VirtualConsole } from 'jsdom';
import { signOut } from '@/lib/auth-client';
import common from '../../messages/en/common.json';
import SigningOutGate from './signing-out-gate';

let root: Root;
let dom: JSDOM;
let descriptors: Map<string, PropertyDescriptor | undefined>;

beforeEach(async () => {
  descriptors = new Map(
    ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  // The sign-out ends in a page load, which jsdom only reports.
  dom = new JSDOM('<div id="root"></div>', {
    url: 'https://example.test/acme/MKT',
    virtualConsole: new VirtualConsole(),
  });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ common }} timeZone="UTC">
        <SigningOutGate>
          <p>Board</p>
        </SigningOutGate>
      </NextIntlClientProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

it('swaps the app for the signing-out screen as soon as a sign-out starts', async () => {
  assert.equal(document.body.textContent, 'Board');

  let leaving!: Promise<void>;
  act(() => {
    leaving = signOut();
  });

  assert.equal(document.body.textContent, 'Signing out…');
  await act(() => leaving);
});
