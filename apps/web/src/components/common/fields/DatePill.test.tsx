import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import messages from '../../../../messages/en/common.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'Event',
  'CustomEvent',
  'FocusEvent',
  'MouseEvent',
  'KeyboardEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

async function openPicker() {
  const { default: DatePill } = await import('./DatePill');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ common: messages }} timeZone="UTC">
        <DatePill value={null} onChange={() => {}} />
      </NextIntlClientProvider>,
    ),
  );
  await act(async () =>
    document.querySelector<HTMLElement>('[data-slot="popover-trigger"]')!.click(),
  );
  await settle();
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/',
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
    requestAnimationFrame: {
      configurable: true,
      value: dom.window.requestAnimationFrame.bind(dom.window),
    },
    cancelAnimationFrame: {
      configurable: true,
      value: dom.window.cancelAnimationFrame.bind(dom.window),
    },
    ResizeObserver: {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('DatePill', () => {
  // A month spans 4, 5 or 6 weeks, and any 14 months in a row hold both 5 and 6. The calendar
  // always shows 6, so it keeps one height and the month buttons stay under the pointer.
  it('shows six weeks in every month while paging forward', async () => {
    await openPicker();
    const next = document.querySelector<HTMLElement>('.rdp-button_next')!;
    for (let month = 0; month < 14; month++) {
      assert.equal(document.querySelectorAll('.rdp-week').length, 6);
      await act(async () => next.click());
    }
  });
});
