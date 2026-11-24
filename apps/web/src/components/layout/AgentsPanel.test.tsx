import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { ShellCtx, type ShellContext } from '@/context/shellContext';
import { SyncProvider } from '@/context/syncContext';
import { RelativeTimeProvider } from '@/context/relativeTimeContext';
import type { SidePanelState, SidePanelTab } from '@/hooks/useSidePanel';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { PREFERENCE_DEFAULTS } from '@/services/preferences.service';
import { qk } from '@/services/queryKeys';
import aiChat from '../../../messages/en/aiChat.json';
import common from '../../../messages/en/common.json';
import issue from '../../../messages/en/issue.json';
import nav from '../../../messages/en/nav.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'localStorage',
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
  'MouseEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'matchMedia',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

const page = { items: [], total: 0, page: 1, pageSize: 15, queued: 0, running: 2, failed: 0 };

const project = {
  project: { id: 3, ref: 'eng.RUN', teamId: 5 },
  viewer: { role: 'member', teamRole: 'member', via: 'member' },
  permissions: { ai_agents: { read: true } },
} as unknown as ProjectDetail;

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let requests: string[];
let originals: Map<string, PropertyDescriptor | undefined>;

async function renderPanel({ open = true, tab }: { open?: boolean; tab: SidePanelTab }) {
  client.setQueryData(qk.accountPreferences, PREFERENCE_DEFAULTS);
  const panel = {
    open,
    tab,
    mode: 'overlay',
    fullscreen: false,
    show: () => {},
    close: () => {},
    toggleMode: () => {},
    toggleFullscreen: () => {},
  } satisfies SidePanelState;
  const { default: AgentsPanel } = await import('./AgentsPanel');
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SyncProvider>
          <NextIntlClientProvider
            locale="en"
            timeZone="UTC"
            messages={{ aiChat, common, issue, nav }}
          >
            <RelativeTimeProvider>
              <ShellCtx.Provider value={{ project } as unknown as ShellContext}>
                <AgentsPanel
                  project={project}
                  projectKey="eng.RUN"
                  panel={panel}
                  onClose={() => {}}
                  newChatAgentId={null}
                  onNewChatHandled={() => {}}
                  runId={null}
                  onOpenRun={() => {}}
                />
              </ShellCtx.Provider>
            </RelativeTimeProvider>
          </NextIntlClientProvider>
        </SyncProvider>
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
}

const tabs = () => [...document.querySelectorAll('[role="tab"]')];
const chat = () =>
  [...document.querySelectorAll('*')].find(
    (node) => !node.children.length && node.textContent === aiChat.emptyTitle,
  );
const runsSearch = () => document.querySelector('input[type="search"]');

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  requests = [];
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });
  for (const name of replacedGlobals) {
    if (name in dom.window)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
  }
  const matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: matchMedia });
  Object.defineProperties(globalThis, {
    matchMedia: { configurable: true, value: matchMedia },
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
    fetch: {
      configurable: true,
      value: async (input: RequestInfo | URL) => {
        requests.push(String(input));
        return Response.json(String(input).includes('/agent-runs/queue') ? page : []);
      },
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('AgentsPanel', () => {
  it('has the chat and the runs as tabs, with how many runs work', async () => {
    await renderPanel({ tab: 'chat' });
    const [first, second] = tabs().map((tab) => tab.textContent);
    assert.equal(first, aiChat.chatPanel);
    assert.ok(second!.startsWith(issue.agentRuns.queueTitle));
    assert.ok(second!.includes('2 runs working'));
  });

  it('keeps the chat as it is behind the runs', async () => {
    await renderPanel({ tab: 'chat' });
    const before = chat();
    assert.ok(before);
    assert.equal(runsSearch(), null);

    await renderPanel({ tab: 'runs' });
    assert.ok(runsSearch());
    assert.ok(chat() === before);

    await renderPanel({ tab: 'chat' });
    assert.ok(chat() === before);
    assert.equal(runsSearch(), null);
  });

  it('loads neither tab before it is opened', async () => {
    await renderPanel({ tab: 'chat', open: false });
    assert.equal(chat(), undefined);
    await renderPanel({ tab: 'runs', open: false });
    assert.equal(runsSearch(), null);
    await renderPanel({ tab: 'runs' });
    assert.equal(chat(), undefined);
  });
});
