import type { DbExecutor } from './client';
import { team, teamMember } from './schema';

export const TEAM_SLUG_PATTERN = '^[a-z][a-z0-9-]{0,38}[a-z0-9]$';

// The web app puts the team first in its paths (/acme/MKT), so a slug must not be one
// of its own top-level segments.
const RESERVED_SLUGS = new Set([
  'account',
  'api',
  'docs',
  'forgot-password',
  'god',
  'invite',
  'issue',
  'login',
  'media',
  'oauth',
  'project',
  'protected-media',
  'register',
  'reset-password',
  'settings',
  'share',
  'workspaces',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

// A team with `ownerId` as its owner. Run it in a transaction so neither row is written
// without the other.
export async function insertOwnedTeam(
  executor: DbExecutor,
  workspaceId: number,
  name: string,
  ownerId: string,
  slug: string | null,
) {
  const [row] = await executor.insert(team).values({ workspaceId, name, slug }).returning();
  const [membership] = await executor
    .insert(teamMember)
    .values({ teamId: row!.id, userId: ownerId, role: 'owner' })
    .returning();
  return { team: row!, membership: membership! };
}
