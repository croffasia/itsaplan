import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { WidgetType } from '@/utils/dashboardWidgets';
import dashboards from '../../../../messages/en/dashboards.json';
import common from '../../../../messages/en/common.json';
import AddWidgetPanel from './AddWidgetPanel';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
let dom: JSDOM;
let root: Root;
let calls: string[];
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function render(addedTypes: WidgetType[]) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ dashboards, common }} timeZone="UTC">
        <AddWidgetPanel
          addedTypes={addedTypes}
          dragging={false}
          onDragStart={(type) => calls.push(`drag:${type}`)}
          onDragEnd={() => calls.push('dragend')}
          onUndo={() => calls.push('undo')}
          onClose={() => calls.push('close')}
        />
      </NextIntlClientProvider>,
    ),
  );
}

function button(text: string) {
  const found = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  assert.ok(found, `no button with "${text}"`);
  return found;
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/project/TEST/dashboards',
  });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  calls = [];
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

describe('AddWidgetPanel', () => {
  it('lets each widget be dragged, counts the copies and takes the last one back', () => {
    render([]);
    assert.ok(document.body.textContent?.includes('Nothing added yet'));
    assert.equal(document.body.textContent?.includes(dashboards.addPanel.undo), false);
    const rows = document.querySelectorAll('[draggable="true"]');
    assert.equal(rows.length, 11);

    render(['burnup', 'pulse', 'burnup']);
    const burnup = [...rows].find((r) => r.textContent?.includes(dashboards.widgets.burnup.label));
    assert.ok(burnup?.textContent?.includes('Added 2'));
    assert.ok(document.body.textContent?.includes('3 widgets added'));
    act(() => button(dashboards.addPanel.undo).click());
    assert.deepEqual(calls, ['undo']);
  });

  it('narrows the list to one group', () => {
    render([]);
    act(() => button(dashboards.widgetGroups.agents).click());
    const text = document.body.textContent ?? '';
    assert.ok(text.includes(dashboards.widgets.agent_runs.label));
    assert.equal(text.includes(dashboards.widgets.burnup.label), false);
  });
});
