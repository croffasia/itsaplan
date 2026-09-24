import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DevelopmentLink } from '@/lib/api/endpoints/git';
import {
  groupDevelopmentLinks,
  isBuildDevelopmentLink,
  worstPipelineStatus,
} from './groupDevelopmentLinks';

function link(
  partial: Partial<DevelopmentLink> & Pick<DevelopmentLink, 'id' | 'kind'>,
): DevelopmentLink {
  return {
    provider: 'gitlab',
    repository: 'org/app',
    number: null,
    title: 'branch',
    url: null,
    state: 'open',
    draft: false,
    sourceBranch: null,
    targetBranch: 'main',
    headSha: null,
    pipelineStatus: null,
    pipelineUrl: null,
    checkStatus: null,
    checks: [],
    updatedAt: '2026-09-16T00:00:00.000Z',
    ...partial,
  };
}

describe('groupDevelopmentLinks', () => {
  it('keeps merge requests as the primary work and collapses CI branches by repo', () => {
    const grouped = groupDevelopmentLinks([
      link({
        id: 1,
        kind: 'pull_request',
        number: 320,
        title: 'Final pages',
        sourceBranch: 'feat/SEKTA-662-pregnancy-final',
        state: 'merged',
        pipelineStatus: 'failed',
        updatedAt: '2026-09-16T01:00:00.000Z',
      }),
      link({
        id: 2,
        kind: 'branch',
        title: 'ci/SEKTA-662-v1.117.57',
        sourceBranch: 'ci/SEKTA-662-v1.117.57',
        pipelineStatus: 'success',
        updatedAt: '2026-09-16T08:00:00.000Z',
      }),
      link({
        id: 3,
        kind: 'branch',
        repository: 'org/demo',
        title: 'stage/SEKTA-662-pregnancy',
        sourceBranch: 'stage/SEKTA-662-pregnancy',
        pipelineStatus: 'skipped',
        updatedAt: '2026-09-11T00:00:00.000Z',
      }),
      link({
        id: 4,
        kind: 'branch',
        title: 'feat/SEKTA-662-extra',
        sourceBranch: 'feat/SEKTA-662-extra',
        pipelineStatus: 'running',
        updatedAt: '2026-09-16T03:00:00.000Z',
      }),
      link({
        id: 5,
        kind: 'branch',
        title: 'feat/SEKTA-662-pregnancy-final',
        sourceBranch: 'feat/SEKTA-662-pregnancy-final',
      }),
    ]);

    assert.deepEqual(
      grouped.pullRequests.map((item) => item.id),
      [1],
    );
    assert.deepEqual(
      grouped.workBranches.map((item) => item.id),
      [4],
    );
    assert.deepEqual(
      grouped.builds.map((item) => item.id),
      [2, 3],
    );
    assert.deepEqual(
      grouped.buildsByRepo.map((group) => [
        group.repository,
        group.links.map((item) => item.id),
        group.status,
      ]),
      [
        ['org/app', [2], 'success'],
        ['org/demo', [3], 'skipped'],
      ],
    );
  });

  it('orders open merge requests ahead of merged ones', () => {
    const grouped = groupDevelopmentLinks([
      link({
        id: 1,
        kind: 'pull_request',
        number: 1,
        state: 'merged',
        updatedAt: '2026-09-16T10:00:00.000Z',
      }),
      link({
        id: 2,
        kind: 'pull_request',
        number: 2,
        state: 'open',
        updatedAt: '2026-09-16T01:00:00.000Z',
      }),
    ]);
    assert.deepEqual(
      grouped.pullRequests.map((item) => item.id),
      [2, 1],
    );
  });

  it('treats pipeline-titled branch links as builds', () => {
    assert.equal(
      isBuildDevelopmentLink(link({ id: 1, kind: 'branch', title: 'Pipeline #2853744737' })),
      true,
    );
  });
});

describe('worstPipelineStatus', () => {
  it('ranks a failure above a passing run', () => {
    assert.equal(worstPipelineStatus(['success', 'failed', 'running']), 'failed');
    assert.equal(worstPipelineStatus([null, 'success']), 'success');
    assert.equal(worstPipelineStatus([null, undefined]), null);
  });
});
