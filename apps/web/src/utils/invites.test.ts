import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mayRenewInvite } from './invites';

// The same rules as mayGrantInviteRanks on the API, which answers 403 to anyone else.
describe('mayRenewInvite', () => {
  const teamOwner = { teamRole: 'owner', ownsProject: false };
  const manager = { teamRole: 'manager', ownsProject: false };
  const projectOwner = { teamRole: 'member', ownsProject: true };
  const member = { teamRole: 'member', ownsProject: false };

  it('lets anyone who may invite renew an invite that grants no rank', () => {
    const plain = { teamRole: 'member', role: 'member' } as const;
    for (const viewer of [teamOwner, manager, projectOwner, member]) {
      assert.equal(mayRenewInvite(plain, viewer), true);
    }
  });

  it('leaves a team rank to the team owner', () => {
    for (const teamRole of ['manager', 'owner'] as const) {
      const rank = { teamRole, role: null };
      assert.equal(mayRenewInvite(rank, teamOwner), true);
      assert.equal(mayRenewInvite(rank, manager), false);
      assert.equal(mayRenewInvite(rank, projectOwner), false);
    }
  });

  it("leaves a project's ownership to whoever runs the team or owns the project", () => {
    const ownership = { teamRole: 'member', role: 'owner' } as const;
    assert.equal(mayRenewInvite(ownership, teamOwner), true);
    assert.equal(mayRenewInvite(ownership, manager), true);
    assert.equal(mayRenewInvite(ownership, projectOwner), true);
    assert.equal(mayRenewInvite(ownership, member), false);
  });
});
