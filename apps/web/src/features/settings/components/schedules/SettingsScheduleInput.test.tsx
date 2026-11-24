import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, useState } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import { setDisplayTimezone } from '@/utils/dates';
import settings from '../../../../../messages/en/settings.json';

// Dubai keeps one offset all year, UTC+4, so these do not depend on the date they run.
const ZONE = 'Asia/Dubai';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'SVGElement',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'localStorage',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let saved: string;

async function render(initial: string) {
  const { SettingsScheduleInput } = await import('./SettingsScheduleInput');
  function Form() {
    const [value, setValue] = useState(initial);
    saved = value;
    return <SettingsScheduleInput id="schedule" value={value} onChange={setValue} />;
  }
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ settings }} timeZone="UTC">
        <Form />
      </NextIntlClientProvider>,
    ),
  );
}

const input = () => document.querySelector<HTMLInputElement>('#schedule')!;

function clock(label: string) {
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent === label);
  assert.ok(button);
  return button;
}

async function pick(label: string) {
  await act(async () => {
    clock(label).dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
  });
}

async function type(text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(input(), text);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
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
    ResizeObserver: {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    },
    fetch: { configurable: true, value: () => new Promise(() => {}) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  Object.defineProperty(window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://example.test', privacyUrl: '', termsUrl: '' },
  });
  setDisplayTimezone(ZONE);
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  setDisplayTimezone('');
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

const line = () => document.querySelector('[aria-live]')?.textContent;

describe('SettingsScheduleInput', () => {
  it('starts on UTC', async () => {
    await render('0 7 * * *');

    assert.equal(clock('UTC').getAttribute('aria-selected'), 'true');
    assert.equal(line(), 'Runs: At 7:00 AM UTC');
  });

  it('describes a cron on the user clock under the input, which stays as it is', async () => {
    await render('0 7 * * *');
    await pick('My time');

    assert.equal(line(), 'Runs: At 11:00 AM');
    assert.equal(input().value, '0 7 * * *');
    assert.equal(saved, '0 7 * * *');
  });

  it('describes a written schedule on the user clock too', async () => {
    await render('Every day at 9:00 AM');
    await pick('My time');

    assert.equal(line(), 'Cron: 0 9 * * * · At 1:00 PM');
    assert.equal(input().value, 'Every day at 9:00 AM');
    assert.equal(saved, 'Every day at 9:00 AM');
  });

  it('takes what is typed as UTC on either clock', async () => {
    await render('0 7 * * *');
    await pick('My time');
    await type('0 9 * * *');

    assert.equal(saved, '0 9 * * *');
    assert.equal(line(), 'Runs: At 1:00 PM');
  });

  it('does not call UTC days the user clock', async () => {
    await render('*/15 * * * 1-5');
    await pick('My time');

    assert.equal(line(), 'Runs: Every 15 minutes on weekdays UTC');
  });

  it('stays in UTC for a schedule that cannot be moved to the user clock', async () => {
    await render('0 23 1 * *');
    await pick('My time');

    assert.ok(line()?.endsWith(' UTC'));
    assert.ok(line()?.startsWith('Runs: '));
  });

  it('remembers the last clock on every input', async () => {
    await render('0 7 * * *');
    await pick('My time');
    await act(async () => root.unmount());

    const { createRoot } = await import('react-dom/client');
    root = createRoot(document.querySelector('#root')!);
    await render('0 9 * * *');

    assert.equal(clock('My time').getAttribute('aria-selected'), 'true');
    assert.equal(line(), 'Runs: At 1:00 PM');
  });
});
