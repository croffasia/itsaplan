import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIssueBranchName } from './issuePrompt';

describe('buildIssueBranchName', () => {
  it('uses the account email and a branch-safe issue slug', () => {
    assert.equal(
      buildIssueBranchName(
        { identifier: 'ENG-64', title: 'Development: CI & review status' },
        { name: 'Alex', email: 'alex@example.com' },
      ),
      'alex/eng-64-development-ci-review-status',
    );
  });

  it('falls back to an identifier-only branch for a non-latin title', () => {
    assert.equal(
      buildIssueBranchName(
        { identifier: 'ENG-7', title: 'Проверить пилот' },
        { email: 'alex.smith@example.com' },
      ),
      'alexsmith/eng-7',
    );
  });
});
