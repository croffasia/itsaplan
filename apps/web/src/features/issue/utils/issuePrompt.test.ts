import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIssueBranchName } from './issuePrompt';

describe('buildIssueBranchName', () => {
  it('uses the account email and a branch-safe issue slug', async () => {
    assert.equal(
      await buildIssueBranchName(
        { identifier: 'ENG-64', title: 'Development: CI & review status' },
        { name: 'Alex', email: 'alex@example.com' },
      ),
      'alex/eng-64-development-ci-review-status',
    );
  });

  it('transliterates a title in another script', async () => {
    assert.equal(
      await buildIssueBranchName(
        { identifier: 'ENG-7', title: 'Проверить пилот' },
        { email: 'alex.smith@example.com' },
      ),
      'alexsmith/eng-7-proverit-pilot',
    );
    assert.equal(
      await buildIssueBranchName({ identifier: 'ENG-8', title: '修复登录' }, { name: 'Анна' }),
      'anna/eng-8-xiu-fu-deng-lu',
    );
  });

  it('falls back to an identifier-only branch for a title with no letters', async () => {
    assert.equal(
      await buildIssueBranchName(
        { identifier: 'ENG-9', title: '🚀 !!!' },
        { email: 'a@example.com' },
      ),
      'a/eng-9',
    );
  });
});
