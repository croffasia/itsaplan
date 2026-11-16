import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import issue from '../../../../../messages/en/issue.json';
import CommentReactions from './CommentReactions';

const globals = ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'] as const;
const reactions = [
  {
    emoji: '👍',
    users: [
      { id: 'u-ana', name: 'Ana' },
      { id: 'u-ben', name: 'Ben' },
    ],
  },
  { emoji: '🎉', users: [{ id: 'u-ben', name: 'Ben' }] },
];

let dom: JSDOM;
let root: Root;
let previous: Map<string, PropertyDescriptor | undefined>;

beforeEach(() => {
  dom = new JSDOM('<div id="root"></div>', { url: 'http://web.test/' });
  previous = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of globals) {
    const value = key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key];
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  root = createRoot(document.getElementById('root')!);
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const key of globals) {
    const descriptor = previous.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

async function show(props: { viewerId?: string; onToggle?: (emoji: string) => void }) {
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={{ issue }} timeZone="UTC">
        <CommentReactions reactions={reactions} {...props} />
      </NextIntlClientProvider>,
    );
  });
}

const chips = () => [...document.querySelectorAll('[aria-label*="reacted with"]')];

describe('CommentReactions', () => {
  it('shows a chip per emoji with its count, who reacted, and which are the viewer’s own', async () => {
    await show({ viewerId: 'u-ana', onToggle: () => {} });

    assert.deepEqual(
      chips().map((chip) => [
        chip.textContent,
        chip.getAttribute('aria-label'),
        chip.getAttribute('aria-pressed'),
      ]),
      [
        ['👍2', 'Ana and Ben reacted with 👍', 'true'],
        ['🎉1', 'Ben reacted with 🎉', 'false'],
      ],
    );
    assert.ok(document.querySelector('button[aria-label="Add reaction"]'));
  });

  it('switches the reaction of the chip that is pressed', async () => {
    const toggled: string[] = [];
    await show({ viewerId: 'u-ana', onToggle: (emoji) => toggled.push(emoji) });

    await act(async () => (chips()[1] as HTMLButtonElement).click());
    assert.deepEqual(toggled, ['🎉']);
  });

  it('shows the reactions without a button where reacting is not offered', async () => {
    await show({});

    assert.deepEqual(
      chips().map((chip) => chip.textContent),
      ['👍2', '🎉1'],
    );
    assert.equal(document.querySelectorAll('button').length, 0);
  });
});
