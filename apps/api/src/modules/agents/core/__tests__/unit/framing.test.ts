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
  documentId: null,
  documentTitle: null,
  documentQuote: null,
  threadRootId: null,
};

describe('framePrompt', () => {
  it('frames a document mention as a reply in its thread, with the thread for context', () => {
    const text = framePrompt({
      ...run,
      trigger: 'mention',
      prompt: '@bot can you check this?',
      issueId: null,
      issueIdentifier: null,
      issueTitle: null,
      documentId: 12,
      documentTitle: 'Onboarding',
      documentQuote: 'Ship on Friday',
      threadRootId: 'root-id',
      threadContext: 'Ann: Is Friday realistic?',
    });
    expect(text).toContain('"Onboarding" (documentId 12)');
    expect(text).toContain('add_document_comment tool (documentId 12, parentId root-id)');
    expect(text).toContain('Ship on Friday');
    expect(text).toContain('Ann: Is Friday realistic?');
    expect(text.endsWith('@bot can you check this?')).toBe(true);
    expect(text).not.toContain('issueId');
  });

  it('frames an answer to the agent in a document thread as one, not as a mention', () => {
    const text = framePrompt({
      ...run,
      trigger: 'mention',
      prompt: 'Thanks, now the summary',
      issueId: null,
      issueIdentifier: null,
      issueTitle: null,
      documentId: 12,
      documentTitle: 'Onboarding',
      threadRootId: 'root-id',
    });
    expect(text.startsWith('Someone answered your comment on the document "Onboarding"')).toBe(
      true,
    );
    expect(text).toContain('The answer to your comment:');
  });

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
