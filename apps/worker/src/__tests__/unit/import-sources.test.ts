import { describe, it, expect } from 'bun:test';
import { readerForJob, sourceProjectKeyForJob } from '../../import-sources';
import { PlaneReader } from '../../plane-adapter';

const planeCredential = {
  baseUrl: 'https://plane.example.test',
  workspaceSlug: 'acme',
  apiKey: 'plane-api-key',
};

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

  it.each(['jira', 'linear', 'toString', ''])('refuses the unsupported source "%s"', (source) => {
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
});
