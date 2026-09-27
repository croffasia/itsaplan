import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TEAM_SLUG_PATTERN, suggestTeamSlug } from './teamSlug';

describe('suggestTeamSlug', () => {
  it('builds a valid slug from a name', () => {
    assert.equal(suggestTeamSlug('Acme Design'), 'acme-design');
    assert.equal(suggestTeamSlug('  42 -- Ops!  '), 'ops');
    assert.equal(suggestTeamSlug('Команда'), 'komanda');
    const long = suggestTeamSlug(`a${'-b'.repeat(30)}`);
    assert.ok(TEAM_SLUG_PATTERN.test(long), long);
  });
});
