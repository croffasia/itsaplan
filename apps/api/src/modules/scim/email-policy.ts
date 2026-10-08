export type ScimEmailPolicy = (workspaceId: number, email: string) => Promise<boolean>;

const allowAny: ScimEmailPolicy = async () => true;

// Whether a workspace's identity provider may provision an address. A self-hosted
// instance takes any address, since only its owner sets up provisioning; a hosted build
// installs a check against the domains the workspace has verified.
let policy: ScimEmailPolicy = allowAny;

export function setScimEmailPolicy(next: ScimEmailPolicy = allowAny): void {
  policy = next;
}

export function isScimEmailAllowed(workspaceId: number, email: string): Promise<boolean> {
  return policy(workspaceId, email);
}
