import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import auth from '../../messages/en/auth.json';
import es from '../../messages/es-ES/auth.json';
import { useRefusalMessage } from './useRefusalMessage';

// The server's messages are English; a form shows the visitor's language instead.
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

// The shape of the errors the auth service throws (a feature module this layer does not import).
function refusal(message: string, code?: string, status?: number) {
  return Object.assign(new Error(message), { code, status });
}

function Message({ err, fallback }: { err: unknown; fallback?: string }) {
  return <p>{useRefusalMessage()(err, fallback)}</p>;
}

function render(
  err: unknown,
  {
    fallback,
    locale = 'en',
    messages = { auth },
  }: { fallback?: string; locale?: string; messages?: object } = {},
): string {
  act(() =>
    root.render(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        <Message err={err} fallback={fallback} />
      </NextIntlClientProvider>,
    ),
  );
  return document.querySelector('p')?.textContent ?? '';
}

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

describe('useRefusalMessage', () => {
  it('words a refusal by its code, in the visitor language', () => {
    const err = refusal('Invalid email or password', 'INVALID_EMAIL_OR_PASSWORD', 401);
    assert.equal(render(err), auth.errors.invalidCredentials);
    assert.equal(
      render(err, { locale: 'es-ES', messages: { auth: es } }),
      es.errors.invalidCredentials,
    );
  });

  it('words a rate-limited request by its status', () => {
    const err = refusal('Too many requests. Please try again later.', undefined, 429);
    assert.equal(render(err), auth.errors.tooManyRequests);
  });

  it('takes the text a build names for a code of its own', () => {
    const messages = {
      auth: { ...auth, errors: { ...auth.errors, codes: { SEAT_LIMIT: 'No seats left.' } } },
    };
    assert.equal(render(refusal('Seat limit', 'SEAT_LIMIT', 403), { messages }), 'No seats left.');
  });

  // The passkey client always sends "Auth cancelled", in English.
  it('prefers the caller fallback to the server message for an unnamed code', () => {
    const err = refusal('Auth cancelled', 'AUTH_CANCELLED', 400);
    assert.equal(render(err, { fallback: auth.errors.passkey }), auth.errors.passkey);
  });

  it('shows the server message for an unnamed code, and the generic text without one', () => {
    assert.equal(render(refusal('Something odd', 'ODD', 400)), 'Something odd');
    assert.equal(render(refusal('', 'ODD', 400)), auth.errors.generic);
  });
});
