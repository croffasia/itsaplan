import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import palette from '../../../messages/en/palette.json';
import type { PaletteSearchScope } from './hooks/usePaletteSearchScope';

const replaced = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
];

let dom: JSDOM;
let root: Root;
let chosen: PaletteSearchScope[];
let ran: string[];
let descriptors: Map<string, PropertyDescriptor | undefined>;

// The switch sits inside the palette's cmdk root, next to a selected command.
async function render(scope: PaletteSearchScope) {
  const { Command, CommandItem, CommandList } = await import('@/components/ui/command');
  const { default: CommandPaletteScope } = await import('./CommandPaletteScope');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ palette }} timeZone="UTC">
        <Command>
          <CommandPaletteScope scope={scope} onChange={(next) => chosen.push(next)} />
          <CommandList>
            <CommandItem value="new-issue" onSelect={() => ran.push('new-issue')}>
              New issue
            </CommandItem>
          </CommandList>
        </Command>
      </NextIntlClientProvider>,
    ),
  );
}

async function key(target: HTMLElement, value: string) {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
    );
    // Radix moves the focus between triggers on the next tick.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function trigger(text: string) {
  const found = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (tab) => tab.textContent === text,
  );
  assert.ok(found, text);
  return found;
}

beforeEach(async () => {
  descriptors = new Map(
    replaced.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  for (const name of replaced) {
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
  chosen = [];
  ran = [];
  Object.defineProperties(globalThis, {
    requestAnimationFrame: {
      configurable: true,
      value: dom.window.requestAnimationFrame.bind(dom.window),
    },
    cancelAnimationFrame: {
      configurable: true,
      value: dom.window.cancelAnimationFrame.bind(dom.window),
    },
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

it('marks the chosen scope and reports a click on the other one', async () => {
  await render('all');
  assert.equal(trigger('All projects').getAttribute('aria-selected'), 'true');
  assert.equal(trigger('This project').getAttribute('aria-selected'), 'false');

  await act(async () => trigger('This project').click());
  assert.deepEqual(chosen, ['current']);
});

it('keeps the focus where it is when a scope is pressed', async () => {
  await render('all');
  const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  await act(async () => trigger('This project').dispatchEvent(press));
  assert.equal(press.defaultPrevented, true);
});

it('switches with the arrow keys', async () => {
  await render('all');
  const all = trigger('All projects');
  await act(async () => all.focus());
  await key(all, 'ArrowLeft');
  assert.equal(document.activeElement, trigger('This project'));
  assert.deepEqual(chosen, ['current']);
});

it("selects a scope with Enter and leaves the palette's command alone", async () => {
  await render('all');
  assert.equal(document.querySelector('[cmdk-item]')!.getAttribute('aria-selected'), 'true');
  const current = trigger('This project');
  await act(async () => current.focus());
  chosen = [];
  await key(current, 'Enter');
  assert.deepEqual(chosen, ['current']);
  assert.deepEqual(ran, []);
});
