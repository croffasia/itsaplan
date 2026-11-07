import { describe, it, expect } from 'bun:test';
import { readerForJob, registerImportSource, sourceProjectKeyForJob } from '../../import-sources';
import { LinearReader } from '../../linear-adapter';
import { PlaneReader } from '../../plane-adapter';
import { TrelloReader } from '../../trello-adapter';
import { UnsupportedImportSourceError, type SourceReader } from '../../reader';

const planeCredential = {
  baseUrl: 'https://plane.example.test',
  workspaceSlug: 'acme',
  apiKey: 'plane-api-key',
};

const linearCredential = { apiKey: 'lin_api_test' };

const trelloCredential = { apiKey: 'trellokey1', token: 'ATTAtoken1' };
const trelloConfig = { boardId: 'board1', archivedCards: 'archive' };

describe('readerForJob', () => {
  it('builds a Plane reader for a Plane job', () => {
    const job = { id: 7, source: 'plane', config: { planeProjectId: 'project-1' } };
    expect(readerForJob(job, planeCredential)).toBeInstanceOf(PlaneReader);
  });

  it('refuses a Plane job with no source project', () => {
    const job = { id: 7, source: 'plane', config: {} };
    expect(() => readerForJob(job, planeCredential)).toThrow(
      'import job 7 has no source project configured',
    );
  });

  it('builds a Linear reader for one project of a team, or for its issues with no project', () => {
    const forProject = {
      id: 8,
      source: 'linear',
      config: { teamId: 'team-1', teamKey: 'ATO', projectFilter: 'project', projectId: 'p-1' },
    };
    const forNoProject = {
      id: 8,
      source: 'linear',
      config: { teamId: 'team-1', teamKey: 'ATO', projectFilter: 'none', projectId: null },
    };
    expect(readerForJob(forProject, linearCredential)).toBeInstanceOf(LinearReader);
    expect(readerForJob(forNoProject, linearCredential)).toBeInstanceOf(LinearReader);
  });

  it.each([
    { teamKey: 'ATO', projectFilter: 'none', projectId: null },
    { teamId: 'team-1', teamKey: 'ATO', projectFilter: 'project', projectId: null },
    { teamId: 'team-1', teamKey: 'ATO' },
  ])('refuses a Linear job with no complete scope: %o', (config) => {
    const job = { id: 8, source: 'linear', config };
    expect(() => readerForJob(job, linearCredential)).toThrow(
      'import job 8 has no source project configured',
    );
  });

  it.each([
    ['a Plane-shaped credential', planeCredential],
    ['an empty apiKey', { apiKey: '' }],
    ['a non-string apiKey', { apiKey: 42 }],
  ])('refuses a Linear job whose credential is %s', (_name, credential) => {
    const job = {
      id: 8,
      source: 'linear',
      config: { teamId: 'team-1', teamKey: 'ATO', projectFilter: 'none', projectId: null },
    };
    expect(() => readerForJob(job, credential as never)).toThrow(
      'import job 8 has a credential that is not a Linear API key',
    );
  });

  it('builds a Trello reader for a board', () => {
    const job = { id: 9, source: 'trello', config: trelloConfig };
    expect(readerForJob(job, trelloCredential)).toBeInstanceOf(TrelloReader);
  });

  it.each([
    { archivedCards: 'archive' },
    { boardId: 'board1' },
    { boardId: 'board1', archivedCards: 'keep' },
  ])('refuses a Trello job with no complete board config: %o', (config) => {
    const job = { id: 9, source: 'trello', config };
    expect(() => readerForJob(job, trelloCredential)).toThrow(
      'import job 9 has no source board configured',
    );
  });

  it.each([
    ['a Linear-shaped credential', linearCredential],
    ['an empty token', { apiKey: 'trellokey1', token: '' }],
    ['an extra field', { ...trelloCredential, baseUrl: 'https://trello.example.test' }],
  ])('refuses a Trello job whose credential is %s', (_name, credential) => {
    const job = { id: 9, source: 'trello', config: trelloConfig };
    expect(() => readerForJob(job, credential as never)).toThrow(
      'import job 9 has a credential that is not a Trello key and token',
    );
  });

  it('marks an unsupported source as a permanent error', () => {
    const job = { id: 7, source: 'jira', config: {} };
    expect(() => readerForJob(job, planeCredential)).toThrow(UnsupportedImportSourceError);
  });

  it.each(['jira', 'toString', ''])('refuses the unsupported source "%s"', (source) => {
    const job = { id: 7, source, config: { planeProjectId: 'project-1' } };
    expect(() => readerForJob(job, planeCredential)).toThrow(
      `import job 7 has unsupported source "${source}"`,
    );
  });
});

describe('registerImportSource', () => {
  it('adds a source that jobs of that name are read with', () => {
    const reader = {} as SourceReader;
    const seen: unknown[] = [];
    registerImportSource<{ token: string }, { boardKey: string }>('registered-test', {
      buildReader(credential, config, jobId) {
        seen.push(credential, config, jobId);
        return reader;
      },
      projectKey: (config) => config.boardKey ?? null,
    });
    const job = { id: 11, source: 'registered-test', config: { boardKey: 'KEY' } };

    expect(readerForJob(job, { token: 't' })).toBe(reader);
    expect(seen).toEqual([{ token: 't' }, { boardKey: 'KEY' }, 11]);
    expect(sourceProjectKeyForJob(job)).toBe('KEY');
  });

  it('refuses a name that is already taken', () => {
    expect(() =>
      registerImportSource('trello', {
        buildReader: () => ({}) as SourceReader,
        projectKey: () => null,
      }),
    ).toThrow('import source "trello" is already registered');
  });
});

describe('sourceProjectKeyForJob', () => {
  it("returns a Plane job's project identifier", () => {
    const job = {
      id: 7,
      source: 'plane',
      config: { planeProjectId: 'p', planeProjectKey: 'ROOMS' },
    };
    expect(sourceProjectKeyForJob(job)).toBe('ROOMS');
  });

  it('returns null for a Plane job created before the Rewrite phase existed', () => {
    const job = { id: 7, source: 'plane', config: { planeProjectId: 'p' } };
    expect(sourceProjectKeyForJob(job)).toBeNull();
  });

  it("returns a Linear job's team key", () => {
    const job = {
      id: 8,
      source: 'linear',
      config: { teamId: 'team-1', teamKey: 'ATO', projectFilter: 'none', projectId: null },
    };
    expect(sourceProjectKeyForJob(job)).toBe('ATO');
  });

  it('returns null for a Trello job: a card has no key-style identifier', () => {
    expect(sourceProjectKeyForJob({ id: 9, source: 'trello', config: trelloConfig })).toBeNull();
  });
});
