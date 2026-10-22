import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import god from '../../../../../messages/en/god.json';

// With the password form off, an account can only come from a sign-in provider, so each
// mode is described in those terms instead of by the sign-up page.

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;

const modes = god.authentication.modes;

async function render(passwordless: boolean) {
  const { default: RegistrationModePicker } = await import('./RegistrationModePicker');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ god }} timeZone="UTC">
        <RegistrationModePicker value="open" onChange={() => {}} passwordless={passwordless} />
      </NextIntlClientProvider>,
    ),
  );
}

const descriptions = () =>
  [...document.querySelectorAll('[role="radio"] .text-xs')].map((element) => element.textContent);

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', { url: 'https://planner.test/god/authentication' });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(() => root.unmount());
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

describe('RegistrationModePicker', () => {
  it('describes each mode by the sign-up page while the password form is on', async () => {
    await render(false);
    assert.deepEqual(descriptions(), [
      modes.open.description,
      modes.invite.description,
      modes.closed.description,
    ]);
  });

  it('describes each mode by the sign-in provider while the password form is off', async () => {
    await render(true);
    assert.deepEqual(descriptions(), [
      modes.open.descriptionPasswordless,
      modes.invite.descriptionPasswordless,
      modes.closed.descriptionPasswordless,
    ]);
  });
});
