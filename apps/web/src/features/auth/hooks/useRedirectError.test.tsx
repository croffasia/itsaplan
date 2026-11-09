import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import auth from '../../../../messages/en/auth.json';
import { useRedirectError } from './useRedirectError';

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

function Message({ error }: { error: string }) {
  return <p>{useRedirectError()(error)}</p>;
}

function render(error: string, messages = { auth }): string {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <Message error={error} />
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

// The ?error= values are the ones the api's registration-refusal-redirect test pins.
describe('useRedirectError', () => {
  it('names a closed registration', () => {
    assert.equal(render('REGISTRATION_CLOSED'), auth.errors.registrationClosed);
  });

  it('names an invite-only instance', () => {
    assert.equal(render('INVITE_ONLY'), auth.errors.inviteOnly);
  });

  it("names a build's own code by the text the build gives it", () => {
    const text = 'Sign out at your identity provider, then try again.';
    const messages = { auth: { ...auth, errors: { ...auth.errors, codes: { BUILD_CODE: text } } } };
    assert.equal(render('BUILD_CODE', messages), text);
  });

  it('shows the generic text for an unknown error', () => {
    assert.equal(render('something_else'), auth.errors.generic);
  });

  it('shows the generic text for a code named like an object property', () => {
    assert.equal(render('toString'), auth.errors.generic);
    assert.equal(render('constructor'), auth.errors.generic);
  });

  it('names an MCP authorization for a client the instance does not know', () => {
    assert.equal(render('invalid_client'), auth.errors.oauthClientUnknown);
    assert.equal(render('invalid_redirect'), auth.errors.oauthRedirectUnknown);
    assert.equal(render('client_disabled'), auth.errors.oauthClientRefused);
    assert.equal(render('unauthorized_client'), auth.errors.oauthClientRefused);
  });
});
