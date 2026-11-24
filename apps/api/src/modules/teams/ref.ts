import { project, team } from '@repo/db';
import { sql } from 'drizzle-orm';

// How URLs name a team and a project. A team is its slug, or its id while it has
// none; a project is "<teamRef>.<key>".

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

// The full URL of an issue's page, or undefined when the web origin is not configured
// (then messages carry no link rather than a localhost fallback).
export function issueUrl(teamRef: string, key: string, seq: number): string | undefined {
  const base = process.env.APP_URL;
  return base ? `${base}${issueWebPath(teamRef, key, seq)}` : undefined;
}

// The full URL of a comment on its issue's page, or undefined as for issueUrl.
export function commentUrl(
  teamRef: string,
  key: string,
  seq: number,
  commentId: number,
): string | undefined {
  const url = issueUrl(teamRef, key, seq);
  return url && `${url}#comment-${commentId}`;
}

// The full URL of a document's page, e.g. "/acme/MKT/docs/12" on the web origin, or
// undefined as for issueUrl.
export function documentUrl(teamRef: string, key: string, documentId: number): string | undefined {
  const base = process.env.APP_URL;
  return base ? `${base}/${teamRef}/${key}/docs/${documentId}` : undefined;
}
