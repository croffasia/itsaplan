import type { MemberOption } from '../components/members/MemberPicker';

export const OWNER_VALUE = 'owner';

// An agent works under a role, which caps what its key and its tools may do, so it is
// never offered ownership: the API refuses it, and the row controls already hide it.
export function ownerOffered(canGrantOwner: boolean, target: MemberOption | null): boolean {
  return canGrantOwner && !(target?.kind === 'member' && target.candidate.isAgent);
}

// The role the dialog submits: the one picked, unless that is an owner no longer on
// offer (an agent was chosen after it), and otherwise the team's default.
export function chosenRole(
  roleValue: string,
  defaultRoleId: number | undefined,
  owner: boolean,
): string {
  if (roleValue && (roleValue !== OWNER_VALUE || owner)) return roleValue;
  return defaultRoleId != null ? String(defaultRoleId) : '';
}
