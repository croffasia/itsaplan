import { describe, it, expect } from 'bun:test';
import { numberRef, repoPath } from '../client';

describe('gitea helpers', () => {
  it('takes an issue number bare, hashed, or from the issue URL', () => {
    expect(numberRef(12)).toBe(12);
    expect(numberRef('#12')).toBe(12);
    expect(numberRef('https://git.example.com/acme/widgets/issues/12')).toBe(12);
    expect(() => numberRef('an issue')).toThrow('not a Gitea issue or pull request number or URL');
  });

  it('builds the repository path with each segment encoded', () => {
    expect(repoPath('acme', 'widgets')).toBe('repos/acme/widgets');
    expect(repoPath('a cme', 'wi/dgets')).toBe('repos/a%20cme/wi%2Fdgets');
  });
});
