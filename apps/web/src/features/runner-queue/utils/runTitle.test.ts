import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { runTitle } from './runTitle';

const run = (fields: Partial<RunnerQueueRun>) =>
  ({ issueTitle: null, scheduleName: null, prompt: '', ...fields }) as RunnerQueueRun;

it('names a run by its issue, then its schedule', () => {
  assert.equal(runTitle(run({ issueTitle: 'Fix login', scheduleName: 'Daily' })), 'Fix login');
  assert.equal(runTitle(run({ scheduleName: 'Daily digest' })), 'Daily digest');
});

it('names a run on no issue by the first line of its task that is not a heading', () => {
  const prompt =
    '## Context\n\n### Workflow\n\nWrite Article, run 54 in project `team.COPY`.\n\nMore text.';
  assert.equal(runTitle(run({ prompt })), 'Write Article, run 54 in project team.COPY.');
  assert.equal(
    runTitle(run({ prompt: '- **Check** the [docs](https://x.dev)' })),
    'Check the docs',
  );
  assert.equal(runTitle(run({ prompt: '# Only a heading' })), 'Only a heading');
});
