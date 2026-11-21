import assert from 'node:assert/strict';
import { it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { SyncProvider } from '@/context/syncContext';
import { qk } from '@/services/queryKeys';
import issue from '../../../../messages/en/issue.json';
import common from '../../../../messages/en/common.json';
import AgentRunExternalTrace from './AgentRunExternalTrace';

type Run = Parameters<typeof AgentRunExternalTrace>[0]['run'];
const received: Run = { id: 1, status: 'success', receivedAt: '2026-01-01T00:00:00Z' };

function markup(denied = false, run: Run = received, traced = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const key = [...qk.externalRunTrace(1), null];
  client.setQueryData(
    key,
    traced
      ? {
          attempt: 1,
          previousAttempt: null,
          sessionId: '0199a213-81c0-7800-8aa1-bbab2a035a53',
          sessionUrl: 'codex://threads/0199a213-81c0-7800-8aa1-bbab2a035a53',
          truncated: true,
          events: [
            {
              receivedAt: '2026-01-01T00:00:00Z',
              event: {
                type: 'TEXT_MESSAGE_CONTENT',
                delta: 'Private trace <script>alert(1)</script>',
              },
            },
          ],
        }
      : null,
  );
  if (denied)
    client
      .getQueryCache()
      .find({ queryKey: key })!
      .setState({ status: 'error', error: new Error('Access denied') });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SyncProvider>
        <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ issue, common }}>
          <AgentRunExternalTrace run={run} />
        </NextIntlClientProvider>
      </SyncProvider>
    </QueryClientProvider>,
  );
  client.clear();
  return html;
}

it('renders the local session link and truncation notice while sanitizing event text', () => {
  const html = markup();
  assert.match(html, /href="codex:\/\/threads\/0199a213-81c0-7800-8aa1-bbab2a035a53"/);
  assert.match(html, /recording limit/);
  assert.match(html, /Private trace/);
  assert.doesNotMatch(html, /<script|alert\(1\)/);
});

it('hides cached external events and session links when access is denied', () => {
  const html = markup(true);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /Private trace|codex:\/\/threads/);
});

it('tells a run the agent never received from one its runner sent no steps of', () => {
  const refused = markup(false, { id: 1, status: 'failed', receivedAt: null }, false);
  assert.match(refused, /did not receive this run/);
  assert.doesNotMatch(refused, /update the runner/);
  assert.match(markup(false, received, false), /update the runner/);
  assert.match(markup(false, { id: 1, status: 'pending', receivedAt: null }, false), /yet/);
});
