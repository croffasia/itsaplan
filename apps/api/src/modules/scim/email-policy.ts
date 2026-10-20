export type ScimEmailPolicy = (workspaceId: number | null, email: string) => Promise<boolean>;

const allowAny: ScimEmailPolicy = async () => true;

// Whether an identity provider may provision an address: a workspace's, or the
// instance's for null. By default any address, since only god sets up the instance's
// provider; a hosted build installs a check against the domains a workspace verified.
let policy: ScimEmailPolicy = allowAny;

export function setScimEmailPolicy(next: ScimEmailPolicy = allowAny): void {
  policy = next;
}

export function isScimEmailAllowed(workspaceId: number | null, email: string): Promise<boolean> {
  return policy(workspaceId, email);
}
