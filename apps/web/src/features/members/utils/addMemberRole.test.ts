import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MemberCandidate } from '@/lib/api/endpoints/members';
import type { MemberOption } from '../components/members/MemberPicker';
import { OWNER_VALUE, chosenRole, ownerOffered } from './addMemberRole';

function candidate(isAgent: boolean): MemberOption {
  const c: MemberCandidate = {
    userId: 'u',
    name: 'n',
    email: 'e',
    username: null,
    image: null,
    isAgent,
  };
  return { kind: 'member', candidate: c };
}

describe('add member role', () => {
  it('offers Owner for a person or an invite, never for an agent', () => {
    assert.equal(ownerOffered(true, candidate(false)), true);
    assert.equal(ownerOffered(true, { kind: 'invite', email: 'x@example.com' }), true);
    assert.equal(ownerOffered(true, candidate(true)), false);
    assert.equal(ownerOffered(false, candidate(false)), false);
  });

  it('falls back to the default role when Owner was picked before choosing an agent', () => {
    assert.equal(chosenRole(OWNER_VALUE, 7, false), '7');
    assert.equal(chosenRole(OWNER_VALUE, 7, true), OWNER_VALUE);
    assert.equal(chosenRole('9', 7, false), '9');
    assert.equal(chosenRole('', 7, true), '7');
  });
});
