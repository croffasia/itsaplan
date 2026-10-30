import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { View } from '@/lib/api/endpoints/views';
import { ShellCtx, type ShellContext } from '@/context/shellContext';
import common from '../../../messages/en/common.json';
import views from '../../../messages/en/views.json';

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

function view(id: number, name: string, isPrivate: boolean, hidden = false): View {
  return {
    id,
    projectId: 1,
    name,
    icon: null,
    filters: { conditions: [] },
    display: { layout: 'kanban' } as View['display'],
    position: id,
    shareToken: null,
    shareExtended: false,
    isPrivate,
    favorite: false,
    hidden,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

const board = view(1, 'Board', false);
const mine = view(2, 'Mine', true);
const roadmap = view(3, 'Roadmap', false, true);

let dom: JSDOM;
let root: Root;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;
let duplicated: View[];
let shown: View[];

// A member whose role only reads views.
const reader = {
  project: { viewer: { role: 'member', via: 'member' }, permissions: { views: { read: true } } },
} as unknown as ShellContext;

// A member whose role edits the project's views.
const editor = {
  project: {
    viewer: { role: 'member' },
    permissions: { views: { read: true, create: true, edit: true, delete: true } },
  },
} as unknown as ShellContext;

async function render(activeViewId: number, shell = reader) {
  const { default: ViewTabs } = await import('./ViewTabs');
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="en" messages={{ common, views }} timeZone="UTC">
          <ShellCtx.Provider value={shell}>
            <ViewTabs
              views={[mine, board, roadmap]}
              projectKey="eng.P01"
              activeViewId={activeViewId}
              onSelect={() => {}}
              onNewView={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
              onDuplicate={(v) => duplicated.push(v)}
              onArrangeRow={() => {}}
              onHide={() => {}}
              onShow={(v) => shown.push(v)}
              onResetRow={() => {}}
              onPinProjectOrder={() => {}}
              onToggleFilter={() => {}}
              displayControl={null}
            />
          </ShellCtx.Provider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

async function openMenu(): Promise<string[]> {
  const trigger = document.querySelector<HTMLElement>(`[title="${views.options}"]`);
  assert.ok(trigger);
  await act(async () => trigger.click());
  return [...document.querySelectorAll<HTMLElement>('[data-slot="popover-content"] button')].map(
    (b) => b.textContent?.trim() ?? '',
  );
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
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
  Object.defineProperty(window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://api.test', privacyUrl: '', termsUrl: '' },
  });
  duplicated = [];
  shown = [];
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

describe('ViewTabs', () => {
  it('offers no new view to a member who cannot read views, whose save would be refused', async () => {
    const blind = {
      project: {
        viewer: { role: 'member', via: 'member' },
        permissions: { views: { read: false } },
      },
    } as unknown as ShellContext;
    await render(board.id, blind);
    const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim());
    assert.ok(!buttons.includes(views.newView));
  });

  it('lets a member who only reads views save one, and shows their own row, own views tinted', async () => {
    await render(board.id);
    const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim());
    assert.ok(buttons.includes(views.newView));
    const tabs = [...document.querySelectorAll('[aria-roledescription="sortable"]')];
    assert.deepEqual(
      tabs.map((tab) => [
        tab.textContent?.trim(),
        tab.className.includes('text-primary'),
        tab.getAttribute('aria-disabled'),
      ]),
      [
        [mine.name, true, 'false'],
        [board.name, false, 'false'],
      ],
    );
  });

  it('offers no new view and no duplicate to a workspace admin, who keeps no private views', async () => {
    const admin = {
      project: {
        viewer: { role: 'member', via: 'workspace' },
        permissions: { views: { read: true } },
      },
    } as unknown as ShellContext;
    await render(board.id, admin);
    const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim());
    assert.ok(!buttons.includes(views.newView));
    assert.ok(buttons.includes(views.hiddenViews.replace('{count}', '1')));
    assert.deepEqual(await openMenu(), [views.favorite, views.hide]);
  });

  it("offers a new project's view to the workspace owner", async () => {
    const owner = {
      project: { viewer: { role: 'owner', via: 'workspace' }, permissions: {} },
    } as unknown as ShellContext;
    await render(board.id, owner);
    const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim());
    assert.ok(buttons.includes(views.newView));
  });

  it("offers to duplicate and hide the project's view, without its share, edit or delete", async () => {
    await render(board.id);
    const items = await openMenu();
    assert.deepEqual(items, [views.favorite, views.duplicate, views.hide]);

    const duplicate = [...document.querySelectorAll<HTMLElement>('button')].find(
      (b) => b.textContent?.trim() === views.duplicate,
    );
    await act(async () => duplicate!.click());
    assert.deepEqual(
      duplicated.map((v) => v.id),
      [board.id],
    );
  });

  it('lets the owner of a private view duplicate, edit and delete it, with no share link or hide', async () => {
    await render(mine.id);
    const items = await openMenu();
    assert.deepEqual(items, [views.favorite, views.duplicate, common.edit, common.delete]);
  });

  it('keeps the hidden views at the end of the row, to show again', async () => {
    await render(board.id);
    const label = views.hiddenViews.replace('{count}', '1');
    const trigger = [...document.querySelectorAll<HTMLElement>('button')].find(
      (b) => b.textContent?.trim() === label,
    );
    assert.ok(trigger);
    await act(async () => trigger.click());
    const items = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="popover-content"] button'),
    ];
    assert.deepEqual(
      items.map((b) => b.textContent?.trim()),
      [views.show, views.resetTabRow],
    );
    await act(async () => items[0].click());
    assert.deepEqual(
      shown.map((v) => v.id),
      [roadmap.id],
    );
  });

  it("offers whoever edits views to make their row the project's order", async () => {
    await render(board.id, editor);
    const trigger = document.querySelector<HTMLElement>(`[title="${views.tabRow}"]`);
    await act(async () => trigger!.click());
    const items = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="popover-content"] button'),
    ];
    assert.ok(items.map((b) => b.textContent?.trim()).includes(views.pinProjectOrder));
  });
});
