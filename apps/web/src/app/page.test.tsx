import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { projectPath } from '@/utils/paths';
import common from '../../messages/en/common.json';
import shell from '../../messages/en/shell.json';

type SessionSnapshot = ReturnType<(typeof import('@/lib/auth-client'))['useSession']>;
// Loading the test helper without Bun's globals preserves the web app's fetch type.
const { spyOn } = createRequire(import.meta.url)('bun:test') as {
  spyOn: (
    target: object,
    method: string,
  ) => {
    mockImplementation: (implementation: () => SessionSnapshot) => { mockRestore: () => void };
  };
};

const project = { id: 1, ref: 'acme.SUP', isHidden: false, isFavorite: false };
const lastProject = { id: 2, ref: 'acme.OPS', isHidden: false, isFavorite: false };
const globals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
let originals: Map<string, PropertyDescriptor | undefined>;
let dom: JSDOM;
let root: Root;
let client: QueryClient;
let restoreSession: () => void;
let replaced: string[];
let answer: (path: string) => Response;
let session: { user: { id: string } } | null;

beforeEach(async () => {
  originals = new Map(
    globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/' });
  Object.assign(dom.window, { __ITSAPLAN_ENV__: { apiUrl: 'http://api.test' } });
  replaced = [];
  session = null;
  answer = (path) => Response.json(path === '/projects' ? [project] : []);
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
    fetch: {
      configurable: true,
      value: async (input: string | URL | Request) => answer(new URL(String(input)).pathname),
    },
  });
  const auth = await import('@/lib/auth-client');
  const sessionSpy = spyOn(auth, 'useSession').mockImplementation(
    () => ({ data: session, isPending: false, error: null, refetch: async () => {} }) as never,
  );
  restoreSession = () => sessionSpy.mockRestore();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  act(() => root.unmount());
  restoreSession();
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

async function renderHome() {
  const { default: Home } = await import('./page');
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  const router = {
    replace: (path: string) => replaced.push(path),
    push() {},
    refresh() {},
    back() {},
    forward() {},
    prefetch() {},
  };
  await act(async () => {
    root.render(
      <AppRouterContext.Provider value={router as never}>
        <QueryClientProvider client={client}>
          <NextIntlClientProvider locale="en" messages={{ common, shell }} timeZone="UTC">
            <Home />
          </NextIntlClientProvider>
        </QueryClientProvider>
      </AppRouterContext.Provider>,
    );
  });
  // The page decides once its reads settle, a few ticks after the first render.
  for (let tick = 0; tick < 10; tick++) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  }
}

it('reopens the last-used project from the preferences when the client has a session', async () => {
  session = { user: { id: 'user-1' } };
  answer = (path) => {
    if (path === '/projects') return Response.json([project, lastProject]);
    if (path === '/account/preferences') return Response.json({ lastProjectId: lastProject.id });
    return Response.json([]);
  };

  await renderHome();

  assert.deepEqual(replaced, [projectPath(lastProject.ref)]);
});

// better-auth reports no session when its session request failed or came back empty.
it('opens the project when the client has no session to read the preferences with', async () => {
  await renderHome();

  assert.deepEqual(replaced, [projectPath(project.ref)]);
});

it('says the projects could not be loaded instead of loading forever', async () => {
  answer = (path) =>
    path === '/projects'
      ? Response.json({ error: 'Unavailable' }, { status: 500 })
      : Response.json([]);

  await renderHome();

  assert.ok(document.body.textContent?.includes(shell.loadFailedTitle));
  assert.deepEqual(replaced, []);
});

it('says the projects could not be loaded when the list is empty and the teams fail', async () => {
  answer = (path) =>
    path === '/teams'
      ? Response.json({ error: 'Unavailable' }, { status: 500 })
      : Response.json([]);

  await renderHome();

  assert.ok(document.body.textContent?.includes(shell.loadFailedTitle));
});
