import assert from 'node:assert/strict';
import { it } from 'node:test';
import { runLinks } from './runLinks';

it('keeps each link to this workspace once and leaves out other sites', () => {
  const output = [
    'RESULT:',
    'https://plan.test/team/COPY/docs/20.',
    'See https://plan.test/team/COPY/docs/20 and https://example.com/a',
    'Issue: (https://plan.test/team/COPY/issue/5)',
  ].join('\n');
  assert.deepEqual(runLinks(output, 'https://plan.test'), [
    'https://plan.test/team/COPY/docs/20',
    'https://plan.test/team/COPY/issue/5',
  ]);
});

it('strips trailing punctuation from a link in linear time', () => {
  const origin = 'https://plan.test';
  const started = performance.now();
  assert.deepEqual(runLinks(`${origin}/x${'.'.repeat(200_000)}y`, origin), []);
  assert.ok(performance.now() - started < 500);
});
