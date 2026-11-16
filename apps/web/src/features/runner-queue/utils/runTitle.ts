import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';

// What a run is called: its issue, its schedule, or else the first line of its task that is
// not a heading, as plain text. A task often opens with Markdown headings that name nothing.
export function runTitle(run: RunnerQueueRun): string {
  const named = run.issueTitle ?? run.scheduleName;
  if (named) return named;
  const lines = run.prompt
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  // A title shows two lines at most. The cap also bounds the link pattern below, which takes
  // quadratic time on a long line of unclosed brackets.
  const line = (lines.find((text) => !text.startsWith('#')) ?? lines[0] ?? '').slice(0, 300);
  return line
    .replace(/^(?:#+|>|[-*+]|\d+\.)\s+/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|~~|`|\*/g, '');
}
