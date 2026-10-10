import assert from 'node:assert/strict';
import { it } from 'node:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import IssueContextMenu from './IssueContextMenu';

it('renders a public card without requesting private quick actions', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://web.test/share/view/example' });
  const globals = ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'] as const;
  const previous = new Map(
    globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const key of globals) {
    const value = key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key];
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  window.__ITSAPLAN_ENV__ = { apiUrl: 'http://api.test', privacyUrl: '', termsUrl: '' };
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push(url);
    return Response.json(url.includes('/actions/quick') ? [] : null);
  }) as typeof fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(document.getElementById('root')!);
  // No Shell is mounted on a public share; the menu needs only the project ref.
  const project = { project: { ref: 'example.TEST' }, issues: [] } as unknown as ProjectDetail;
  const issue = { id: 1 } as Issue;
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <NextIntlClientProvider locale="en" timeZone="UTC" messages={{}} onError={() => {}}>
            <IssueContextMenu project={project} issue={issue}>
              <span>Public card</span>
            </IssueContextMenu>
          </NextIntlClientProvider>
        </QueryClientProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    assert.equal(document.getElementById('root')!.textContent, 'Public card');
    assert.deepEqual(
      requests.filter((url) => url.includes('/projects/')),
      [],
    );
  } finally {
    act(() => root.unmount());
    client.clear();
    globalThis.fetch = originalFetch;
    dom.window.close();
    for (const key of globals) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
