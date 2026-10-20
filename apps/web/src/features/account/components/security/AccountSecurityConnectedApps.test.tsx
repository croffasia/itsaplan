import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import account from '../../../../../messages/en/account.json';
import type { ConnectedApp } from '@/lib/api/endpoints/connectedApps';

// The list a person reviews before cutting an MCP client off: who is connected, since
// when and when it last used the account, and the button that starts the revocation.
const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Event',
  'MutationObserver',
  'getComputedStyle',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;

const claude: ConnectedApp = {
  clientId: 'claude',
  name: 'Claude',
  icon: null,
  scopes: ['openid', 'offline_access'],
  connectedAt: '2026-09-01T10:00:00.000Z',
  lastUsedAt: '2026-10-03T10:00:00.000Z',
};

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
  Object.defineProperties(globalThis, {
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

async function render(apps: ConnectedApp[], onDisconnect: (app: ConnectedApp) => void = () => {}) {
  const { default: AccountSecurityConnectedApps } = await import('./AccountSecurityConnectedApps');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ account }} timeZone="UTC">
        <AccountSecurityConnectedApps apps={apps} isPending={false} onDisconnect={onDisconnect} />
      </NextIntlClientProvider>,
    ),
  );
}

describe('AccountSecurityConnectedApps', () => {
  it('says so when no application is connected', async () => {
    await render([]);
    assert.ok(document.body.textContent?.includes('No application is connected'));
  });

  it('names each application with when it was connected and last used', async () => {
    await render([claude]);
    const text = document.body.textContent ?? '';
    assert.ok(text.includes('Claude'));
    assert.ok(text.includes('last used'));
  });

  it('hands the chosen application to the disconnect flow', async () => {
    const chosen: ConnectedApp[] = [];
    await render([claude], (app) => chosen.push(app));

    const button = document.querySelector<HTMLButtonElement>('button[title="Disconnect"]');
    assert.ok(button);
    await act(async () => button!.click());

    assert.deepEqual(chosen, [claude]);
  });
});
