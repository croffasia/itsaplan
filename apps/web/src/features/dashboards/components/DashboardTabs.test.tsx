import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import dashboards from '../../../../messages/en/dashboards.json';
import common from '../../../../messages/en/common.json';
import DashboardTabs from './DashboardTabs';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
let dom: JSDOM;
let root: Root;
let selections: (number | null)[];
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;
function render(active: number | null = null, withSaved = true) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ dashboards, common }} timeZone="UTC">
        <DashboardTabs
          dashboards={
            withSaved
              ? [
                  {
                    id: 7,
                    projectId: 1,
                    name: 'Saved dashboard',
                    icon: null,
                    layout: [],
                    position: 0,
                    createdAt: '2026-01-01T00:00:00Z',
                  },
                ]
              : []
          }
          activeDashboardId={active}
          isVirtual={active === null}
          onSelect={(id) => selections.push(id)}
          onNewDashboard={() => {}}
          onRename={() => {}}
          onDelete={() => {}}
          onReorder={() => {}}
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
  selections = [];
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

describe('DashboardTabs', () => {
  it('keeps Overview selected alongside saved dashboards', () => {
    render();
    const overview = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === dashboards.defaultName,
    );
    assert.ok(overview);
    assert.equal(overview.getAttribute('aria-current'), 'page');
    assert.ok(document.body.textContent?.includes('Saved dashboard'));
  });
  it('returns to Overview from a saved dashboard', () => {
    render(7);
    const overview = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === dashboards.defaultName,
    );
    assert.ok(overview);
    assert.equal(overview.getAttribute('aria-current'), null);
    act(() => overview.click());
    assert.deepEqual(selections, [null]);
  });
  it('keeps Overview available without saved dashboards', () => {
    render(null, false);
    const overview = document.querySelector('button');
    assert.ok(overview);
    assert.equal(overview.textContent, dashboards.defaultName);
    assert.equal(overview.getAttribute('aria-current'), 'page');
  });
});
