import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { Project } from '@/lib/api/endpoints/projects';
import type { Team } from '@/lib/api/endpoints/teams';
import { qk } from '@/services/queryKeys';
import nav from '../../../messages/en/nav.json';
import common from '../../../messages/en/common.json';
import teams from '../../../messages/en/teams.json';

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
  'HTMLFormElement',
  'HTMLSelectElement',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'localStorage',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

const projects: Project[] = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1,
  teamId: 1,
  teamName: 'Engineering',
  teamRef: 'eng',
  key: `P${String(index + 1).padStart(2, '0')}`,
  ref: `eng.P${String(index + 1).padStart(2, '0')}`,
  name: `Project ${index + 1}`,
  description: '',
  mcpEnabled: true,
  teamMcpEnabled: true,
  initiativesEnabled: true,
  dashboardsEnabled: true,
  documentsEnabled: true,
  notesEnabled: true,
  cyclesEnabled: true,
  subtasksEnabled: true,
  checklistsEnabled: true,
  issueStatsEnabled: true,
  availableFeatures: [],
  pointsEstimateEnabled: false,
  timeEstimateEnabled: false,
  timeLoggingEnabled: false,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}));

function team(id: number, workspaceId: number): Team {
  return {
    id,
    workspaceId,
    name: `Team ${id}`,
    slug: null,
    ref: String(id),
    mcpEnabled: true,
    role: 'owner',
    source: 'invite',
    joinedAt: '2026-01-01T00:00:00Z',
    projectCount: 0,
    memberCount: 1,
    ownerCount: 1,
    roleCount: 0,
    integrationCount: 0,
    agentCount: 0,
    skillCount: 0,
    toolCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let selections: string[];
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function element(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  assert.ok(found, selector);
  return found;
}

async function click(selector: string) {
  await act(async () => element(selector).click());
}

async function key(target: HTMLElement, value: string) {
  await act(async () => {
    target.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function render(mobile = true, items = projects) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: mobile ? 390 : 1280 });
  const { Sidebar, SidebarProvider, SidebarTrigger } = await import('@/components/ui/sidebar');
  const { default: ProjectSwitcher } = await import('./ProjectSwitcher');
  const { RelativeTimeProvider } = await import('@/context/relativeTimeContext');
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ nav, common, teams }} timeZone="UTC">
          <RelativeTimeProvider>
            <SidebarProvider>
              <SidebarTrigger />
              <Sidebar>
                <ProjectSwitcher
                  projects={items}
                  currentProjectKey="eng.P01"
                  onSelectProject={(key) => selections.push(key)}
                />
              </Sidebar>
            </SidebarProvider>
          </RelativeTimeProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
  if (mobile) await click('[data-slot="sidebar-trigger"]');
  await click('[data-slot="popover-trigger"]');
}

function touch(target: HTMLElement, type: 'touchstart' | 'touchmove', y: number) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'changedTouches', { value: [{ clientX: 20, clientY: y }] });
  Object.defineProperty(event, 'touches', { value: [{ clientX: 20, clientY: y }] });
  act(() => target.dispatchEvent(event));
  return event;
}

function scrollableList() {
  const list = element('[data-slot="command-list"]');
  // jsdom has no layout engine, so supply the dimensions of an overflowing list.
  Object.defineProperties(list, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 200 },
  });
  list.style.overflowY = 'auto';
  list.scrollTop = 100;
  // jsdom creates a selection on focus, which RemoveScroll treats as a text drag.
  window.getSelection()?.removeAllRanges();
  return list;
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/eng/P01',
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
    fetch: { configurable: true, value: async () => Response.json(null) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  Object.defineProperty(window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://api.test', privacyUrl: '', termsUrl: '' },
  });
  window.matchMedia = (query) => ({
    matches: window.innerWidth < 768,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => true,
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  selections = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(qk.teams, []);
  client.setQueryData(qk.workspaces, []);
  const { createRoot } = await import('react-dom/client');
  root = createRoot(element('#root'));
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  // Better Auth's stores dispose their browser listeners one second after unmount.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('ProjectSwitcher', () => {
  it('allows a swipe that starts on a project inside the mobile sidebar', async () => {
    await render();
    const list = scrollableList();
    const row = element('[data-value="project-2"]');
    assert.equal(element('[data-slot="sidebar"]').contains(list), false);
    touch(row, 'touchstart', 200);
    assert.equal(touch(row, 'touchmove', 140).defaultPrevented, false);
    touch(row, 'touchstart', 140);
    assert.equal(touch(row, 'touchmove', 200).defaultPrevented, false);
    assert.deepEqual(selections, []);
  });

  it('contains mobile scrolling at both ends of the list', async () => {
    await render();
    const list = scrollableList();
    const row = element('[data-value="project-2"]');
    list.scrollTop = 0;
    touch(row, 'touchstart', 140);
    assert.equal(touch(row, 'touchmove', 200).defaultPrevented, true);
    list.scrollTop = 800;
    touch(row, 'touchstart', 200);
    assert.equal(touch(row, 'touchmove', 140).defaultPrevented, true);
    assert.deepEqual(selections, []);
  });

  it('opens on mobile without focusing the search field and still selects on a tap', async () => {
    await render();
    assert.equal(document.activeElement, element('[data-slot="popover-content"]'));
    await click('[data-value="project-2"]');
    assert.deepEqual(selections, ['eng.P02']);
    assert.equal(document.querySelector('[data-slot="popover-content"]'), null);
  });

  it('focuses search on desktop and allows keyboard selection', async () => {
    await render(false);
    const input = element('[data-slot="command-input"]');
    assert.equal(document.activeElement, input);
    assert.equal(document.body.style.pointerEvents, '');
    scrollableList();
    touch(input, 'touchstart', 200);
    assert.equal(touch(input, 'touchmove', 140).defaultPrevented, false);
    await key(input, 'ArrowDown');
    await key(input, 'Enter');
    assert.deepEqual(selections, ['eng.P02']);
  });

  it('keeps the picker scrollable after closing the sort selector', async () => {
    await render();
    const trigger = element('[data-slot="select-trigger"]');
    await key(trigger, 'ArrowDown');
    await key(element('[data-slot="select-content"]'), 'Escape');
    assert.equal(document.querySelector('[data-slot="select-content"]'), null);
    assert.equal(document.activeElement, trigger);
    scrollableList();
    const row = element('[data-value="project-2"]');
    touch(row, 'touchstart', 200);
    assert.equal(touch(row, 'touchmove', 140).defaultPrevented, false);
    assert.deepEqual(selections, []);
  });

  it('lists the teams and projects of the workspace picked on the rail', async () => {
    client.setQueryData(qk.teams, [team(1, 1), team(2, 2)]);
    client.setQueryData(qk.workspaces, [
      { id: 1, name: 'Alpha', role: 'owner' },
      { id: 2, name: 'Beta', role: null },
    ]);
    const other = {
      ...projects[0]!,
      id: 21,
      teamId: 2,
      key: 'B01',
      ref: '2.B01',
      isFavorite: true,
    };
    await render(false, [...projects, other]);
    assert.ok(document.querySelector('[data-value="project-1"]'));
    assert.equal(document.querySelector('[data-value="project-21"]'), null);
    await click('[aria-label="Beta"]');
    assert.ok(document.querySelector('[data-value="project-21"]'));
    assert.equal(document.querySelector('[data-value="project-1"]'), null);
  });

  it('closes the picker before its sidebar and releases the scroll lock', async () => {
    await render();
    await key(element('[data-slot="popover-content"]'), 'Escape');
    assert.equal(document.querySelector('[data-slot="popover-content"]'), null);
    // Radix hands focus back to the trigger in a timeout once the content unmounts.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    assert.equal(document.activeElement, element('[data-slot="popover-trigger"]'));
    await key(element('[data-slot="sidebar"]'), 'Escape');
    assert.equal(document.querySelector('[data-mobile="true"]'), null);
    assert.equal(document.body.style.pointerEvents, '');
    touch(document.body, 'touchstart', 200);
    assert.equal(touch(document.body, 'touchmove', 140).defaultPrevented, false);
  });
});
