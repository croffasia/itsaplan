import { project, team } from '@repo/db';
import { sql } from 'drizzle-orm';

// How URLs name a team and a project. A team is its slug, or its id while it has
// none; a project is "<teamRef>.<key>". The web app puts the team first in its paths
// (/acme/MKT), so a slug must not be one of its own top-level segments.

export const TEAM_SLUG_PATTERN = '^[a-z][a-z0-9-]{0,38}[a-z0-9]$';

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
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export function teamRef(team: { id: number; slug: string | null }): string {
  return team.slug ?? String(team.id);
}

export function projectRef(team: { id: number; slug: string | null }, key: string): string {
  return `${teamRef(team)}.${key}`;
}

// projectRef as a column, for a query that joins team to project.
export const projectRefSql = sql<string>`coalesce(${team.slug}, ${team.id}::text) || '.' || ${project.key}`;

// The web page of an issue, e.g. "/acme/issue/MKT-42".
export function issueWebPath(teamRef: string, key: string, seq: number): string {
  return `/${teamRef}/issue/${key}-${seq}`;
}
