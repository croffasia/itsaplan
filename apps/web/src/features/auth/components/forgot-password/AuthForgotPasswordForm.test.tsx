import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { qk } from '@/services/queryKeys';
import auth from '../../../../../messages/en/auth.json';

// With password sign-in off the identity provider owns the password, so the recovery
// screen sends people there instead of asking for an address to mail a link to.
const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLFormElement',
  'SVGElement',
  'Event',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'localStorage',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;

const router = {
  push() {},
  replace() {},
  refresh() {},
  back() {},
  forward() {},
  prefetch() {},
};

async function render(config: Record<string, unknown> | null) {
  if (config) {
    client.setQueryData(qk.authConfig, {
      registration: 'invite',
      magicLink: false,
      google: false,
      oidc: true,
      oidcLabel: 'Company SSO',
      hasUsers: true,
      ...config,
    });
  }
  const { default: AuthForgotPasswordForm } = await import('./AuthForgotPasswordForm');
  await act(async () =>
    root.render(
      <AppRouterContext.Provider value={router as never}>
        <QueryClientProvider client={client}>
          <NextIntlClientProvider locale="en" messages={{ auth }} timeZone="UTC">
            <AuthForgotPasswordForm />
          </NextIntlClientProvider>
        </QueryClientProvider>
      </AppRouterContext.Provider>,
    ),
  );
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/forgot-password',
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
    // The config request never answers, so a test without seeded config sees it loading.
    fetch: { configurable: true, value: () => new Promise(() => {}) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  Object.defineProperty(window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://example.test', privacyUrl: '', termsUrl: '' },
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('AuthForgotPasswordForm', () => {
  it('points to the identity provider when password sign-in is off', async () => {
    await render({ emailPassword: false });

    assert.equal(document.querySelector('#email'), null);
    assert.ok(document.body.textContent?.includes(auth.forgotPassword.subtitleSso));
    assert.ok(
      [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Company SSO')),
    );
  });

  it('asks for the address when password sign-in is on', async () => {
    await render({ emailPassword: true });

    assert.ok(document.querySelector('#email'));
  });

  it('asks for the address while the config loads', async () => {
    await render(null);

    assert.ok(document.querySelector('#email'));
  });
});
