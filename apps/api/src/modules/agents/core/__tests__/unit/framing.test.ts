import { describe, it, expect } from 'bun:test';
import { projectPreamble } from '../../prompt/framing';
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
