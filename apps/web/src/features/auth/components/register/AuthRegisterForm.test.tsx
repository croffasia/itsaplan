import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { qk } from '@/services/queryKeys';
import auth from '../../../../../messages/en/auth.json';

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
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let restore: (() => void) | undefined;

const { spyOn } = createRequire(import.meta.url)('bun:test') as {
  spyOn: (
    target: object,
    method: string,
  ) => {
    mockImplementation: (implementation: () => Promise<unknown>) => { mockRestore: () => void };
  };
};

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };

async function render(passwordEnabled: boolean) {
  client.setQueryData(qk.authConfig, {
    registration: 'open',
    emailPassword: passwordEnabled,
    hasUsers: true,
    google: false,
    oidc: true,
    oidcLabel: 'Company SSO',
  });
  const service = await import('../../services/auth.service');
  const spy = spyOn(service, 'signInWithOidc').mockImplementation(async () => {
    throw new service.AuthError('Too many requests', undefined, 429);
  });
  restore = () => spy.mockRestore();
  const { default: AuthRegisterForm } = await import('./AuthRegisterForm');
  await act(async () =>
    root.render(
      <AppRouterContext.Provider value={router as never}>
        <QueryClientProvider client={client}>
          <NextIntlClientProvider locale="en" messages={{ auth }} timeZone="UTC">
            <AuthRegisterForm />
          </NextIntlClientProvider>
        </QueryClientProvider>
      </AppRouterContext.Provider>,
    ),
  );
}

async function signInWithProvider() {
  const button = [...document.querySelectorAll('button')].find(
    (one) => one.textContent === 'Company SSO',
  );
  assert.ok(button);
  await act(async () => button.click());
  assert.equal(button.disabled, false);
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/register',
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
  restore?.();
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('AuthRegisterForm', () => {
  it('shows a provider refusal when password sign-in is off', async () => {
    await render(false);
    assert.equal(document.querySelector('input[type="password"]'), null);

    await signInWithProvider();

    assert.equal(
      document.querySelector('[role="alert"]')?.textContent,
      auth.errors.tooManyRequests,
    );
  });

  it('shows the same refusal once above the submit button when password sign-in is on', async () => {
    await render(true);
    assert.ok(document.querySelector('input[type="password"]'));

    await signInWithProvider();

    const errors = document.querySelectorAll('[role="alert"]');
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.textContent, auth.errors.tooManyRequests);
    const submit = document.querySelector('button[type="submit"]');
    assert.ok(submit);
    assert.ok(
      errors[0]!.compareDocumentPosition(submit) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
