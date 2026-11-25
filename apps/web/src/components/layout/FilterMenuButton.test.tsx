import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import * as auth from '@/lib/auth-client';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import common from '../../../messages/en/common.json';
import display from '../../../messages/en/display.json';
import filters from '../../../messages/en/filters.json';
import views from '../../../messages/en/views.json';

const spyOn = createRequire(import.meta.url)('bun:test').spyOn as (
  target: object,
  method: string,
) => { mockReturnValue(value: unknown): { mockRestore(): void } };

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'DocumentFragment',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'FocusEvent',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

const project = {
  project: { ref: 'eng.P01' },
  columns: [],
  issueTypes: [],
  labels: [],
  labelGroups: [],
  plannedCycles: [],
  assignees: [],
  issues: [],
} as unknown as ProjectDetail;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let restoreSession: () => void;
let OPEN_FILTER_MENU_EVENT: string;

// The Shell's key layer, wired the way the Shell wires the filter shortcut.
function KeysProbe({ onBoard }: { onBoard: boolean }) {
  useKeyboardShortcuts({
    hasProject: true,
    onBoard,
    hasAgents: false,
    overlayOpen: false,
    onToggleCommand: () => {},
    onChangeView: () => {},
    onNewIssue: () => {},
    onNewInitiative: () => {},
    onNewProject: () => {},
    onSettings: () => {},
    onToggleChat: () => {},
    onToggleRuns: () => {},
    onOpenFilter: () => window.dispatchEvent(new Event(OPEN_FILTER_MENU_EVENT)),
  });
  return null;
}

async function render(onBoard = true) {
  const button = await import('./FilterMenuButton');
  const FilterMenuButton = button.default;
  OPEN_FILTER_MENU_EVENT = button.OPEN_FILTER_MENU_EVENT;
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider
          locale="en"
          messages={{ common, display, filters, views }}
          timeZone="UTC"
        >
          <KeysProbe onBoard={onBoard} />
          <FilterMenuButton
            filters={{ conditions: [] }}
            onChange={() => {}}
            project={project}
            customFields={[]}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

const menuInput = () => document.querySelector<HTMLInputElement>('[cmdk-input]');

async function press(key: string) {
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost/',
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
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const session = spyOn(auth, 'useSession').mockReturnValue({
    data: { user: { id: 'me', name: 'Alex Active', image: null } },
    isPending: false,
    error: null,
  });
  restoreSession = () => session.mockRestore();
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  restoreSession();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('FilterMenuButton', () => {
  it('opens the filter menu from the button, which names its shortcut', async () => {
    await render();
    const button = document.querySelector<HTMLElement>(`[title="${views.filter} (F)"]`);
    assert.ok(button);
    assert.equal(menuInput(), null);
    await act(async () => button.click());
    assert.equal(menuInput()?.placeholder, filters.menuPlaceholder);
  });

  it('opens the filter menu with F on the work items routes', async () => {
    await render();
    await press('f');
    assert.equal(menuInput()?.placeholder, filters.menuPlaceholder);
  });

  it('leaves F alone elsewhere', async () => {
    await render(false);
    await press('f');
    assert.equal(menuInput(), null);
  });
});
