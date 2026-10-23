import { describe, it, expect } from 'bun:test';
import { apiRoot, graphqlUrl, numberRef, repoPath } from '../client';

describe('github helpers', () => {
  it('takes a number bare, hashed, or from the URL of its kind', () => {
    expect(numberRef(12, 'issue')).toBe(12);
    expect(numberRef('#12', 'issue')).toBe(12);
    expect(numberRef('https://github.com/acme/widgets/issues/12', 'issue')).toBe(12);
    expect(numberRef('https://github.com/acme/widgets/issues/12#issuecomment-345', 'issue')).toBe(
      12,
    );
    expect(
      numberRef(
        'https://github.com/acme/widgets/discussions/7#discussioncomment-345',
        'discussion',
      ),
    ).toBe(7);
    expect(() => numberRef('https://github.com/acme/widgets/discussions/7', 'issue')).toThrow(
      'not a GitHub issue number or URL',
    );
    expect(() => numberRef('a discussion', 'discussion')).toThrow(
      'not a GitHub discussion number or URL',
    );
  });

  it('builds the repository path with each segment encoded', () => {
    expect(repoPath('acme', 'widgets')).toBe('repos/acme/widgets');
    expect(repoPath('a cme', 'wi/dgets')).toBe('repos/a%20cme/wi%2Fdgets');
  });

  it('finds the API root of github.com, GHE.com and an Enterprise Server', () => {
    expect(apiRoot({})).toBe('https://api.github.com');
    expect(apiRoot({ baseUrl: 'https://github.com' })).toBe('https://api.github.com');
    expect(apiRoot({ baseUrl: 'https://api.github.com/' })).toBe('https://api.github.com');
    expect(apiRoot({ baseUrl: 'https://octocorp.ghe.com' })).toBe('https://api.octocorp.ghe.com');
    expect(apiRoot({ baseUrl: 'https://api.octocorp.ghe.com' })).toBe(
      'https://api.octocorp.ghe.com',
    );
    expect(apiRoot({ baseUrl: 'https://github.example.com/' })).toBe(
      'https://github.example.com/api/v3',
    );
    expect(apiRoot({ baseUrl: 'https://github.example.com/api/v3' })).toBe(
      'https://github.example.com/api/v3',
    );
    expect(() => apiRoot({ baseUrl: 'github' })).toThrow('not a valid GitHub address');
  });

  it('finds the GraphQL endpoint beside the API root', () => {
    expect(graphqlUrl({})).toBe('https://api.github.com/graphql');
    expect(graphqlUrl({ baseUrl: 'https://octocorp.ghe.com' })).toBe(
      'https://api.octocorp.ghe.com/graphql',
    );
    expect(graphqlUrl({ baseUrl: 'https://github.example.com' })).toBe(
      'https://github.example.com/api/graphql',
    );
  });
});
