import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import common from '../../../../messages/en/common.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let copied: string[];
let originals: Map<string, PropertyDescriptor | undefined>;

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  copied = [];
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    navigator: {
      configurable: true,
      value: {
        userAgent: '',
        clipboard: { writeText: async (text: string) => void copied.push(text) },
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

describe('AgentChatToolBlock', () => {
  it('copies the whole text of the block', async () => {
    const text = '{\n  "id": 5329,\n  "kind": "comment"\n}';
    const { default: AgentChatToolBlock } = await import('./AgentChatToolBlock');
    await act(async () =>
      root.render(
        <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ common }}>
          <AgentChatToolBlock label="Output" text={text} />
        </NextIntlClientProvider>,
      ),
    );
    const button = document.querySelector('button')!;
    assert.equal(button.getAttribute('aria-label'), common.copy);
    await act(async () => button.click());
    assert.deepEqual(copied, [text]);
    assert.equal(button.getAttribute('aria-label'), common.copied);
  });
});
