import assert from 'node:assert/strict';
import { it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { RelativeTimeProvider } from '@/context/relativeTimeContext';
import type { IssueAgentRun } from '@/lib/api/endpoints/issues';
import issue from '../../../../messages/en/issue.json';
import AgentRunItem from './AgentRunItem';

const run: IssueAgentRun = {
  id: 1,
  agentId: 2,
  username: 'runner',
  kind: 'external',
  status: 'pending',
  executionState: 'queued',
  trigger: 'mention',
  prompt: 'Task',
  output: null,
  attempts: 0,
  lastError: null,
  createdAt: '2026-01-01T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  nextAttemptAt: '2026-01-01T00:00:00Z',
};

function markup(executionState: 'queued' | 'running') {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={{ issue }} timeZone="UTC" now={new Date('2026-01-01T00:00:00Z')}>
      <RelativeTimeProvider>
        <AgentRunItem issueId={null} run={{ ...run, executionState }} />
      </RelativeTimeProvider>
    </NextIntlClientProvider>,
  );
}

it('distinguishes waiting and running while the runner protocol status stays pending', () => {
  const queued = markup('queued');
  const running = markup('running');
  assert.match(queued, /Waiting/);
  assert.doesNotMatch(queued, />Running</);
  assert.match(running, /Running/);
  assert.doesNotMatch(running, />Waiting</);
});
