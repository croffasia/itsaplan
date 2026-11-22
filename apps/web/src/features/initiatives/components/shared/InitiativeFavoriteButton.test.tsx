import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import initiatives from '../../../../../messages/en/initiatives.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Event',
  'MouseEvent',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>');
  for (const name of replacedGlobals) {
    if (name in dom.window) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
    }
  }
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('InitiativeFavoriteButton', () => {
  it('toggles favorite without triggering parent row clicks', async () => {
    const { default: InitiativeFavoriteButton } = await import('./InitiativeFavoriteButton');
    let parentClicks = 0;
    let toggles = 0;

    await act(async () =>
      root.render(
        <NextIntlClientProvider locale="en" messages={{ initiatives }} timeZone="UTC">
          <div onClick={() => (parentClicks += 1)}>
            <InitiativeFavoriteButton favorite={false} onToggle={() => (toggles += 1)} />
          </div>
        </NextIntlClientProvider>,
      ),
    );

    const button = document.querySelector<HTMLButtonElement>('button');
    assert.ok(button);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(button.getAttribute('aria-label'), initiatives.addFavorite);

    await act(async () => button.click());
    assert.equal(toggles, 1);
    assert.equal(parentClicks, 0);
  });

  it('reflects favorited state in aria attributes', async () => {
    const { default: InitiativeFavoriteButton } = await import('./InitiativeFavoriteButton');
    await act(async () =>
      root.render(
        <NextIntlClientProvider locale="en" messages={{ initiatives }} timeZone="UTC">
          <InitiativeFavoriteButton favorite onToggle={() => {}} />
        </NextIntlClientProvider>,
      ),
    );

    const button = document.querySelector<HTMLButtonElement>('button');
    assert.ok(button);
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(button.getAttribute('aria-label'), initiatives.removeFavorite);
  });
});
