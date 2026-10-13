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

function Message({ error, description }: { error: string; description: string | null }) {
  return <p>{useRedirectError()(error, description)}</p>;
}

function render(error: string, description: string | null = null): string {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ auth }} timeZone="UTC">
        <Message error={error} description={description} />
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

  // better-auth sends the gate's English message along; the code wins over it.
  it('names a refusal by its code, not by the description sent with it', () => {
    assert.equal(
      render('REGISTRATION_CLOSED', 'Registration is closed on this instance'),
      auth.errors.registrationClosed,
    );
  });

  it('names an invite-only instance', () => {
    assert.equal(render('INVITE_ONLY'), auth.errors.inviteOnly);
  });

  it('falls back to the description, then to the generic text, for an unknown error', () => {
    assert.equal(render('something_else', 'Provider said no'), 'Provider said no');
    assert.equal(render('something_else'), auth.errors.generic);
  });
});
