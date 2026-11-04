import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import * as auth from '@/lib/auth-client';
import type { SharedDocumentIssue } from '@/lib/api/endpoints/share';
import { IssueRefsProvider } from '@/context/issueRefs';

const spyOn = createRequire(import.meta.url)('bun:test').spyOn as (
  target: object,
  method: string,
) => { mockReturnValue(value: unknown): { mockRestore(): void } };

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let restoreSession: () => void;
let originalFetch: typeof fetch;
let requests: string[];
let IssueRefChip: (typeof import('./IssueRefChip'))['default'];

const issue = (sequence: number, shareToken: string | null): SharedDocumentIssue => ({
  sequence,
  title: `Issue ${sequence}`,
  state: { name: 'In Progress', color: '#22c55e' },
  shareToken,
});

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', { url: 'https://planner.test' });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Node: dom.window.Node,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  ({ default: IssueRefChip } = await import('./IssueRefChip'));
  const session = spyOn(auth, 'useSession').mockReturnValue({
    data: null,
    isPending: false,
    error: null,
  } as ReturnType<typeof auth.useSession>);
  restoreSession = () => session.mockRestore();
  originalFetch = globalThis.fetch;
  requests = [];
  globalThis.fetch = (async (input) => {
    requests.push(String(input));
    return Response.json({});
  }) as typeof fetch;
  root = createRoot(document.getElementById('root')!);
});

afterEach(() => {
  act(() => root.unmount());
  restoreSession();
  globalThis.fetch = originalFetch;
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

describe('IssueRefChip on a share page', () => {
  it('shows the shared issues and links only one with a public link of its own', async () => {
    const shared = new Map([
      [1, issue(1, 'issue-token')],
      [2, issue(2, null)],
    ]);
    const client = new QueryClient();
    await act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <IssueRefsProvider refs={['share.MKT']} shared={shared}>
            <IssueRefChip projectRef="share.MKT" sequence={1} />
            <IssueRefChip projectRef="share.MKT" sequence={2} />
            <IssueRefChip projectRef="share.MKT" sequence={3} />
          </IssueRefsProvider>
        </QueryClientProvider>,
      ),
    );

    const chips = [...document.querySelectorAll('.issue-ref')].map((chip) => ({
      tag: chip.tagName,
      href: chip.getAttribute('href'),
      text: chip.textContent,
    }));
    assert.deepEqual(chips, [
      { tag: 'A', href: '/share/issue/issue-token', text: 'MKT-1Issue 1' },
      { tag: 'SPAN', href: null, text: 'MKT-2Issue 2' },
      { tag: 'SPAN', href: null, text: 'MKT-3' },
    ]);
    assert.deepEqual(requests, []);
  });
});
