import { describe, it, expect } from 'bun:test';
import { readerForJob, sourceProjectKeyForJob } from '../../import-sources';
import { LinearReader } from '../../linear-adapter';
import { PlaneReader } from '../../plane-adapter';
import { UnsupportedImportSourceError } from '../../reader';

const planeCredential = {
  baseUrl: 'https://plane.example.test',
  workspaceSlug: 'acme',
  apiKey: 'plane-api-key',
};

const linearCredential = { apiKey: 'lin_api_test' };

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
});
