import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TEAM_SLUG_PATTERN,
  nameFromTeamSlug,
  normalizeTeamSlugInput,
  suggestTeamSlug,
} from './teamSlug';

describe('suggestTeamSlug', () => {
  it('builds a valid slug from a name', () => {
    assert.equal(suggestTeamSlug('Acme Design'), 'acme-design');
    assert.equal(suggestTeamSlug('  42 -- Ops!  '), 'ops');
    assert.equal(suggestTeamSlug('Команда'), 'komanda');
    assert.equal(suggestTeamSlug('Хлеб и Ґанок'), 'khleb-i-ganok');
    assert.equal(suggestTeamSlug('Ομάδα πωλήσεων'), 'omada-poliseon');
    assert.equal(suggestTeamSlug('北京团队'), 'bei-jing-tuan-dui');
    assert.equal(suggestTeamSlug('Қазақ'), 'kazak');
    const long = suggestTeamSlug(`a${'-b'.repeat(30)}`);
    assert.ok(TEAM_SLUG_PATTERN.test(long), long);
  });
});

describe('normalizeTeamSlugInput', () => {
  it('lowercases and drops a leading slash', () => {
    assert.equal(normalizeTeamSlugInput(' /Acme '), 'acme');
    assert.equal(normalizeTeamSlugInput('/acme'), 'acme');
  });
});

describe('nameFromTeamSlug', () => {
  it('turns a slug into a name', () => {
    assert.equal(nameFromTeamSlug('acme'), 'Acme');
    assert.equal(nameFromTeamSlug('minha-equipe'), 'Minha equipe');
    assert.equal(nameFromTeamSlug('acme-'), 'Acme');
    assert.equal(nameFromTeamSlug(''), '');
  });
});
