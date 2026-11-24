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
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { AgentRunsView } from '@/lib/api/endpoints/userPreferences';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { PREFERENCE_DEFAULTS } from '@/services/preferences.service';
import { qk } from '@/services/queryKeys';
import aiChat from '../../../messages/en/aiChat.json';
import common from '../../../messages/en/common.json';
import documents from '../../../messages/en/documents.json';
import issue from '../../../messages/en/issue.json';
import teams from '../../../messages/en/teams.json';

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

const ROOM_FOR_BOTH = 800;

const run = {
  id: 7,
  agentId: 1,
  username: 'runner',
  kind: 'external',
  status: 'success',
  executionState: 'success',
  trigger: 'manual',
  prompt: 'Inspect task',
  output: 'Selected result',
  attempts: 1,
  lastError: null,
  createdAt: '2026-01-01T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  nextAttemptAt: '2026-01-01T00:00:00Z',
  issueId: null,
  sequenceNumber: null,
  issueTitle: null,
  scheduleId: 1,
  scheduleName: 'Daily digest',
  projectRef: 'eng.RUN',
  initiator: null,
  startedBy: null,
  canceledBy: null,
  parentRun: null,
  rootRun: null,
  document: null,
  canReadSteps: false,
  runnerState: 'online',
  inputTokens: null,
  outputTokens: null,
} as unknown as RunnerQueueRun;

const page = { items: [run], total: 1, page: 1, pageSize: 15, queued: 0, running: 0, failed: 0 };

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let requests: string[];
let originals: Map<string, PropertyDescriptor | undefined>;

async function renderPanel({
  teamRole,
  view = 'full',
  runId = null,
  room = ROOM_FOR_BOTH,
  wide = false,
}: {
  teamRole: 'owner' | 'member';
  view?: AgentRunsView;
  runId?: number | null;
  room?: number;
  wide?: boolean;
}) {
  const project = {
    project: { id: 3, ref: 'eng.RUN', teamId: 5 },
    viewer: { role: 'member', teamRole, via: 'member' },
    permissions: { ai_agents: { read: true } },
  } as unknown as ProjectDetail;
  const api = '/projects/eng.RUN';
  client.setQueryData(qk.accountPreferences, { ...PREFERENCE_DEFAULTS, agentRunsView: view });
  client.setQueryData([...qk.runnerQueue, api, { page: 1, pageSize: 1, runId: 7 }], page);
  client.setQueryData([...qk.runnerQueue, 'initiators', api], []);
  const opened: (number | null)[] = [];
  const { default: RunnerQueuePanel } = await import('./RunnerQueuePanel');
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SyncProvider>
          <NextIntlClientProvider
            locale="en"
            timeZone="UTC"
            messages={{ aiChat, common, documents, issue, teams }}
          >
            <RelativeTimeProvider>
              <ShellCtx.Provider value={{ project } as unknown as ShellContext}>
                <RunnerQueuePanel
                  project={project}
                  wide={wide}
                  room={room}
                  runId={runId}
                  onOpenRun={(id) => opened.push(id)}
                />
              </ShellCtx.Provider>
            </RelativeTimeProvider>
          </NextIntlClientProvider>
        </SyncProvider>
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  return opened;
}

const list = () => document.querySelector<HTMLElement>('input[type="search"]');
const row = () =>
  [...document.querySelectorAll('a')].find((link) => link.textContent?.includes('Daily digest'))!;

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
        return Response.json(String(input).includes('/agent-runs/queue') ? page : null);
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

describe('RunnerQueuePanel', () => {
  it("lists the open project's runs, for whoever runs the team too", async () => {
    await renderPanel({ teamRole: 'owner' });
    assert.ok(requests.length > 0);
    for (const url of requests) assert.ok(!url.includes('/teams/'), url);
    assert.ok(requests.some((url) => url.includes('/projects/eng.RUN/agent-runs/queue')));
  });

  it('opens a run on a plain click and leaves a click for a new tab to the link', async () => {
    const opened = await renderPanel({ teamRole: 'member' });
    assert.equal(row().getAttribute('href'), '/eng/RUN/agents/queue/7');
    const click = (init: MouseEventInit) =>
      new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, ...init });

    await act(async () => void row().dispatchEvent(click({})));
    assert.deepEqual(opened, [7]);

    const newTab = click({ metaKey: true });
    // jsdom follows no link; only whether the panel took the click is asked.
    document.addEventListener('click', (event) => event.preventDefault(), { once: true });
    await act(async () => void row().dispatchEvent(newTab));
    assert.deepEqual(opened, [7]);
  });

  it('shows a run beside the list, and in place of it in the compact view', async () => {
    await renderPanel({ teamRole: 'member', runId: 7 });
    assert.ok(document.querySelector('section[aria-label="Run"]'));
    assert.equal(list()!.closest('.hidden'), null);

    await renderPanel({ teamRole: 'member', runId: 7, view: 'compact' });
    assert.equal(document.querySelector('section[aria-label="Run"]'), null);
    assert.ok(document.body.textContent?.includes('Selected result'));
    assert.ok(list()!.closest('.hidden'));
  });

  it('shows a run in place of the list where there is no room for both', async () => {
    await renderPanel({ teamRole: 'member', runId: 7, room: 300 });
    assert.equal(document.querySelector('section[aria-label="Run"]'), null);
    assert.ok(list()!.closest('.hidden'));
    assert.equal(document.querySelector('button[title="Full view"]'), null);
  });

  it('keeps the list and the run next to each other in full screen', async () => {
    await renderPanel({ teamRole: 'member', wide: true });
    assert.ok(document.body.textContent?.includes(issue.agentRuns.selectRun));

    const opened = await renderPanel({
      teamRole: 'member',
      wide: true,
      runId: 7,
      view: 'compact',
      room: -400,
    });
    assert.equal(list()!.closest('.hidden'), null);
    assert.ok(document.body.textContent?.includes('Selected result'));
    assert.equal(document.querySelector('button[title="Full view"]'), null);

    // The open run is not put away by its own row there.
    await act(
      async () =>
        void row().dispatchEvent(
          new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }),
        ),
    );
    assert.deepEqual(opened, [7]);
  });
});
