import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { qk } from '@/services/queryKeys';
import auth from '../../../../../messages/en/auth.json';

// A reset link the server no longer accepts gets the dead-link screen and its way to a
// new link, not an error line under a form that cannot succeed.
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

// Loading the test helper without Bun's globals preserves the web app's fetch type.
const { spyOn } = createRequire(import.meta.url)('bun:test') as {
  spyOn: (
    target: object,
    method: string,
  ) => {
    mockImplementation: (implementation: () => Promise<unknown>) => { mockRestore: () => void };
  };
};

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };

async function refuseReset(code: string, message: string) {
  const authClient = await import('@/lib/auth-client');
  // better-auth captures fetch at module import, which can precede this fixture in a combined run.
  const spy = spyOn(authClient, 'resetPassword').mockImplementation(async () => ({
    data: null,
    error: { code, message, status: 400, statusText: 'BAD_REQUEST' },
  }));
  restore = () => spy.mockRestore();
}

async function submit() {
  const { default: AuthResetPasswordForm } = await import('./AuthResetPasswordForm');
  await act(async () =>
    root.render(
      <AppRouterContext.Provider value={router as never}>
        <SearchParamsContext.Provider
          value={new URLSearchParams('token=t1&email=ada@example.test') as never}
        >
          <QueryClientProvider client={client}>
            <NextIntlClientProvider locale="en" messages={{ auth }} timeZone="UTC">
              <AuthResetPasswordForm />
            </NextIntlClientProvider>
          </QueryClientProvider>
        </SearchParamsContext.Provider>
      </AppRouterContext.Provider>,
    ),
  );
  const fields = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
  for (const field of fields) {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(field, 'new-password-123');
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }
  await act(async () => {
    document.querySelector('form')!.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/reset-password?token=t1',
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
  client.setQueryData(qk.authConfig, { emailPassword: true });
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

describe('AuthResetPasswordForm', () => {
  it('shows the dead-link screen when the link was already used or expired', async () => {
    await refuseReset('INVALID_TOKEN', 'Invalid token');
    await submit();

    assert.ok(document.body.textContent?.includes(auth.resetPassword.deadLinkDescription));
    assert.equal(document.querySelector('form'), null);
  });

  it('words any other refusal under the form', async () => {
    await refuseReset('PASSWORD_TOO_LONG', 'Password too long');
    await submit();

    assert.ok(document.querySelector('form'));
    assert.ok(document.body.textContent?.includes(auth.errors.passwordTooLong));
  });
});
