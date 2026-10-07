import { describe, it, expect } from 'bun:test';
import { framePrompt, projectPreamble, type RunForPrompt } from '../../prompt/framing';
import { PROJECT_DESCRIPTION_LIMIT } from '#modules/projects/model';

describe('projectPreamble', () => {
  it('adds the description as its own paragraph', () => {
    const text = projectPreamble({ key: 'MKT', name: 'Marketing', description: 'Growth work' });
    expect(text).toContain('\n\nGrowth work\n');
  });

  it('adds nothing when the description is empty', () => {
    const text = projectPreamble({ key: 'MKT', name: 'Marketing', description: '  ' });
    expect(text.endsWith('-123.\n\n')).toBe(true);
  });

  it('cuts a description longer than the limit', () => {
    const description = 'x'.repeat(PROJECT_DESCRIPTION_LIMIT + 100);
    const text = projectPreamble({ key: 'MKT', name: 'Marketing', description });
    expect(text).toContain('x'.repeat(PROJECT_DESCRIPTION_LIMIT));
    expect(text).not.toContain('x'.repeat(PROJECT_DESCRIPTION_LIMIT + 1));
  });
});

const run: RunForPrompt = {
  id: 1,
  trigger: 'field',
  prompt: 'Work item MKT-7: "Checkout" now has you as its "Reviewer". Review it.',
  issueId: 7,
  issueIdentifier: 'MKT-7',
  issueTitle: 'Checkout',
  assigneeName: null,
  assigneeUsername: 'ann',
  requesterName: null,
  requesterUsername: null,
  agentUserId: 'agent-user',
  agentUsername: 'bot',
  threadContext: null,
  sourceActivityId: null,
};

describe('framePrompt', () => {
  it('frames a field run as work on the issue, not as an answer to a comment', () => {
    const text = framePrompt(run);
    expect(text.startsWith(run.prompt)).toBe(true);
    expect(text).toContain('issueId 7');
    expect(text).toContain('@ann');
    expect(text).not.toContain('comment on issue');
  });

  it('frames a status run the same way, with the task its prompt carries', () => {
    const prompt = 'Work item MKT-7: "Checkout" entered the "Analysis" status.\n\nWrite the spec.';
    const text = framePrompt({ ...run, trigger: 'status', prompt });
    expect(text.startsWith(prompt)).toBe(true);
    expect(text).toContain('carry out the task above');
  });
});
