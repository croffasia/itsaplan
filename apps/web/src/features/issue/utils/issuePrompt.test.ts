import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIssueBranchName } from './issuePrompt';

describe('buildIssueBranchName', () => {
  it('uses the account email and a branch-safe issue slug', () => {
    assert.equal(
      buildIssueBranchName(
        { identifier: 'SEKTA-64', title: 'Development: CI & review status' },
        { name: 'Vadim', email: 'vadim@ravefox.dev' },
      ),
      'vadim/sekta-64-development-ci-review-status',
    );
  });

  it('falls back to an identifier-only branch for a non-latin title', () => {
    assert.equal(
      buildIssueBranchName(
        { identifier: 'SEKTA-7', title: 'Проверить пилот' },
        { email: 'groot.bro@example.com' },
      ),
      'grootbro/sekta-7',
    );
  });
});
