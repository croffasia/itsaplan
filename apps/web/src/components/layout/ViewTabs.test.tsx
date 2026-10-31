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
let selected: (number | null)[];
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
              onSelect={(id) => selected.push(id)}
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

const hiddenLabel = views.hiddenViews.replace('{count}', '1');

function hiddenViewsButton() {
  return [...document.querySelectorAll<HTMLElement>('button')].find(
    (b) => b.textContent?.trim() === hiddenLabel,
  );
}

function pickerItems() {
  return [...document.querySelectorAll<HTMLElement>('[cmdk-item]')];
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
  window.HTMLElement.prototype.scrollIntoView = () => {};
  duplicated = [];
  selected = [];
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
    assert.ok(buttons.includes(hiddenLabel));
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

  it('lists the hidden views before New view, to open or to show again', async () => {
    await render(board.id);
    const buttons = [...document.querySelectorAll<HTMLElement>('button')];
    const trigger = hiddenViewsButton();
    const newView = buttons.find((b) => b.textContent?.trim() === views.newView);
    const rowMenu = buttons.find((b) => b.title === views.tabRow);
    assert.ok(trigger && newView && rowMenu);
    assert.ok(buttons.indexOf(trigger) < buttons.indexOf(newView));
    assert.ok(buttons.indexOf(newView) < buttons.indexOf(rowMenu));
    assert.ok(!trigger.className.includes('bg-secondary'));

    await act(async () => trigger.click());
    const items = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="popover-content"] button'),
    ];
    assert.deepEqual(
      items.map((b) => b.textContent?.trim()),
      [roadmap.name, views.show],
    );
    await act(async () => items[1].click());
    assert.deepEqual(
      shown.map((v) => v.id),
      [roadmap.id],
    );
    await act(async () => items[0].click());
    assert.deepEqual(selected, [roadmap.id]);
  });

  it('marks the hidden views button and the view in its menu while a hidden view is open', async () => {
    await render(roadmap.id);
    const trigger = hiddenViewsButton();
    assert.ok(trigger?.className.includes('bg-secondary'));
    await act(async () => trigger!.click());
    const content = document.querySelector('[data-slot="popover-content"]');
    assert.ok(content?.textContent?.includes(roadmap.name));
    assert.ok(content?.querySelector('svg.lucide-check'));
  });

  it('folds the hidden views into the mobile picker, which names one opened by its link', async () => {
    await render(roadmap.id);
    assert.equal(document.querySelectorAll(`[title="${views.tabRow}"]`).length, 1);
    const picker = document.querySelector<HTMLElement>(`[title="${views.switchView}"]`);
    assert.equal(picker?.textContent?.trim(), roadmap.name);
    await act(async () => picker!.click());
    assert.deepEqual(
      pickerItems().map((item) => item.textContent?.trim()),
      [views.all, mine.name, board.name, hiddenLabel, views.newView],
    );
    await act(async () => pickerItems()[3].click());
    assert.deepEqual(
      pickerItems().map((item) => item.textContent?.trim()),
      [views.all, mine.name, board.name, hiddenLabel, roadmap.name, views.newView],
    );
    await act(async () => pickerItems()[4].click());
    assert.deepEqual(selected, [roadmap.id]);
  });

  it('finds a hidden view in the mobile picker search, under its own heading', async () => {
    await render(board.id);
    await act(async () =>
      document.querySelector<HTMLElement>(`[title="${views.switchView}"]`)!.click(),
    );
    const input = document.querySelector<HTMLInputElement>('[cmdk-input]')!;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      setter.call(input, 'road');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assert.deepEqual(
      pickerItems().map((item) => item.textContent?.trim()),
      [roadmap.name],
    );
    assert.equal(document.querySelector('[cmdk-group-heading]')?.textContent, hiddenLabel);
  });

  it("offers whoever edits views to make their row the project's order", async () => {
    await render(board.id, editor);
    const trigger = document.querySelector<HTMLElement>(`[title="${views.tabRow}"]`);
    await act(async () => trigger!.click());
    const items = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="popover-content"] button'),
    ];
    assert.deepEqual(
      items.map((b) => b.textContent?.trim()),
      [views.resetTabRow, views.pinProjectOrder],
    );
  });
});
