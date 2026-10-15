import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIssueBranchName } from './branchName';

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

  it("prefers the account's username to its email", () => {
    assert.equal(
      buildIssueBranchName(
        { identifier: 'CLANS-3', title: 'Empty camps' },
        { username: 'braulio_dev', email: 'bchamerry@example.com' },
      ),
      'braulio_dev/clans-3-empty-camps',
    );
  });

  it("fills in the project's template", () => {
    assert.equal(
      buildIssueBranchName(
        { identifier: 'CLANS-3', title: 'Empty camps' },
        { username: 'alex' },
        'Camps/{key}_{title}',
      ),
      'Camps/clans-3_empty-camps',
    );
  });

  it('fills in the cycle, and drops it with its slash when the issue has none', () => {
    const template = '{cycle}/{key}-{title}';
    const issue = { identifier: 'CLANS-3', title: 'Empty camps' };
    assert.equal(
      buildIssueBranchName({ ...issue, cycle: { name: 'Camps Week 2' } }, undefined, template),
      'camps-week-2/clans-3-empty-camps',
    );
    assert.equal(
      buildIssueBranchName({ ...issue, cycle: null }, undefined, template),
      'clans-3-empty-camps',
    );
  });

  it('drops an empty user and title with their separators', () => {
    assert.equal(
      buildIssueBranchName(
        { identifier: 'ENG-9', title: '!!!' },
        undefined,
        '{user}/{key}-{title}',
      ),
      'eng-9',
    );
  });

  it('keeps the name a valid git ref', () => {
    assert.equal(
      buildIssueBranchName(
        { identifier: 'ENG-1', title: 'Fix' },
        { username: 'alex' },
        ' feature: ~{user}//..{key}..{title}.lock ',
      ),
      'feature-alex/eng-1.fix-lock',
    );
  });

  it('falls back to the issue key when the template leaves nothing', () => {
    assert.equal(
      buildIssueBranchName({ identifier: 'ENG-2', title: 'x' }, undefined, '{unknown}///'),
      'eng-2',
    );
  });
});
