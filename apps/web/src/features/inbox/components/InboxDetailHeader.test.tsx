import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import inbox from '../../../../messages/en/inbox.json';
import issue from '../../../../messages/en/issue.json';
import InboxDetailHeader from './InboxDetailHeader';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
let dom: JSDOM;
let root: Root;
let backCalls: number;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function render({ projectKey = 'TEST', issueSeq = 42, isMobile = false } = {}) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ inbox, issue }} timeZone="UTC">
        <InboxDetailHeader
          projectKey={projectKey}
          issueSeq={issueSeq}
          isMobile={isMobile}
          onBack={() => {
            backCalls += 1;
          }}
        />
      </NextIntlClientProvider>,
    ),
  );
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/project/TEST/inbox',
  });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  backCalls = 0;
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

describe('InboxDetailHeader', () => {
  it('offers a keyboard-accessible full-page link on desktop', () => {
    render();
    const link = document.querySelector('a');
    assert.ok(link);
    assert.equal(link.getAttribute('href'), '/project/TEST/issue/42');
    assert.equal(link.getAttribute('aria-label'), issue.openAsPage);
    assert.equal(link.getAttribute('title'), issue.openAsPage);
    assert.equal(link.tabIndex, 0);
    assert.equal(link.getAttribute('target'), null);
    assert.equal(document.querySelector('button'), null);
    assert.ok(document.querySelector('#root')?.textContent?.includes('TEST-42'));
  });

  it('keeps the mobile back action separate from the full-page link', () => {
    render({ isMobile: true });
    const back = document.querySelector('button');
    assert.ok(back);
    assert.equal(back.textContent, inbox.backToList);
    act(() => back.click());
    assert.equal(backCalls, 1);
    assert.equal(document.querySelector('a')?.getAttribute('href'), '/project/TEST/issue/42');
  });

  it('updates the destination when another notification is selected', () => {
    render();
    render({ issueSeq: 73 });
    assert.equal(document.querySelector('a')?.getAttribute('href'), '/project/TEST/issue/73');
    assert.ok(document.querySelector('#root')?.textContent?.includes('TEST-73'));
    assert.equal(backCalls, 0);
  });

  it('uses the canonical route builder for project keys', () => {
    render({ projectKey: 'R&D', issueSeq: 9 });
    assert.equal(document.querySelector('a')?.getAttribute('href'), '/project/R%26D/issue/9');
  });
});
