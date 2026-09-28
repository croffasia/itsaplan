import { db, issue, project, projectColumn, projectMember, team, teamRole } from '@repo/db';
import { and, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';
import { projectRefSql } from '#modules/teams/ref';

interface SearchFilters {
  q: string;
  kind?: 'all' | 'projects' | 'issues';
  projectKey?: string;
  teamId?: number;
}

function termsMatch(terms: string[], fields: SQL[]): SQL {
  return and(
    ...terms.map((term) => {
      const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
      return or(...fields.map((field) => ilike(field, pattern)))!;
    }),
  )!;
}

export async function searchWorkspace(
  userId: string,
  filters: SearchFilters,
  window: { limit: number; offset: number },
  opts: { mcpOnly: boolean },
) {
  const query = filters.q.trim();
  const terms = [...new Set(query.split(/\s+/))];
  const projectFilter = filters.projectKey?.trim().toLowerCase();
  const membership = and(
    eq(projectMember.userId, userId),
    opts.mcpOnly ? and(eq(project.mcpEnabled, true), eq(team.mcpEnabled, true)) : undefined,
    projectFilter !== undefined
      ? sql`${projectFilter} in (lower(${project.key}), lower(${projectRefSql}))`
      : undefined,
    filters.teamId !== undefined ? eq(project.teamId, filters.teamId) : undefined,
  );
  const projectFields = [sql`${project.key}`, sql`${project.name}`, sql`${project.description}`];
  const identifier = sql<string>`${project.key} || '-' || ${issue.sequenceNumber}`;
  const projectMatches = db
    .select({
      kind: sql<'project' | 'issue'>`'project'`.as('kind'),
      id: project.id,
      title: project.name,
      projectKey: project.key,
      projectRef: sql<string>`${projectRefSql}`.as('project_ref'),
      projectName: sql<string>`${project.name}`.as('project_name'),
      teamId: project.teamId,
      identifier: sql<string | null>`null::text`.as('identifier'),
      columnId: sql<number | null>`null::integer`.as('column_id'),
      columnName: sql<string | null>`null::text`.as('column_name'),
      stateType: sql<string | null>`null::text`.as('state_type'),
      archived: sql<boolean>`false`.as('archived'),
      rank: sql<number>`case
        when lower(${project.key}) = ${query.toLowerCase()} then 0
        when lower(${project.name}) = ${query.toLowerCase()} then 1
        when ${termsMatch(terms, [sql`${project.key}`, sql`${project.name}`])} then 2
        else 3 end`.as('rank'),
    })
    .from(project)
    .innerJoin(team, eq(team.id, project.teamId))
    .innerJoin(projectMember, eq(projectMember.projectId, project.id))
    .where(
      and(
        membership,
        filters.kind === 'issues' ? sql`false` : undefined,
        termsMatch(terms, projectFields),
      ),
    );
  const issueMatches = db
    .select({
      kind: sql<'project' | 'issue'>`'issue'`.as('kind'),
      id: issue.id,
      title: issue.title,
      projectKey: project.key,
      projectRef: sql<string>`${projectRefSql}`.as('project_ref'),
      projectName: sql<string>`${project.name}`.as('project_name'),
      teamId: project.teamId,
      identifier: sql<string | null>`${identifier}`.as('identifier'),
      columnId: sql<number | null>`${projectColumn.id}`.as('column_id'),
      columnName: sql<string | null>`${projectColumn.name}`.as('column_name'),
      stateType: sql<string | null>`${projectColumn.stateType}`.as('state_type'),
      archived: sql<boolean>`${issue.archivedAt} is not null`.as('archived'),
      rank: sql<number>`case
        when lower(${identifier}) = ${query.toLowerCase()} then 0
        when lower(${issue.title}) = ${query.toLowerCase()} then 1
        when ${termsMatch(terms, [sql`${issue.title}`])} then 2
        else 3 end`.as('rank'),
    })
    .from(issue)
    .innerJoin(project, eq(project.id, issue.projectId))
    .innerJoin(team, eq(team.id, project.teamId))
    .innerJoin(projectMember, eq(projectMember.projectId, project.id))
    .leftJoin(teamRole, eq(teamRole.id, projectMember.roleId))
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(
      and(
        membership,
        filters.kind === 'projects' ? sql`false` : undefined,
        // The work_items.read check of assertPermission: a role without a stored matrix
        // has the default member permissions, which include it.
        or(
          eq(projectMember.role, 'owner'),
          isNull(teamRole.permissions),
          sql`${teamRole.permissions} -> 'work_items' -> 'read' = 'true'::jsonb`,
        ),
        termsMatch(terms, [
          sql`${project.key}`,
          sql`${project.name}`,
          identifier,
          sql`${issue.title}`,
          sql`${issue.description}`,
        ]),
      ),
    );
  const matches = unionAll(projectMatches, issueMatches).as('workspace_matches');
  const [rows, counted] = await Promise.all([
    db
      .select()
      .from(matches)
      .orderBy(matches.rank, matches.projectKey, matches.kind, matches.id)
      .limit(window.limit)
      .offset(window.offset),
    db.select({ total: sql<number>`count(*)::integer` }).from(matches),
  ]);
  return {
    items: rows.map((row) => {
      const reference = {
        id: row.id,
        title: row.title,
        projectKey: row.projectKey,
        projectRef: row.projectRef,
        projectName: row.projectName,
        teamId: row.teamId,
      };
      return row.kind === 'project'
        ? { kind: 'project' as const, ...reference }
        : {
            kind: 'issue' as const,
            ...reference,
            identifier: row.identifier!,
            columnId: row.columnId!,
            columnName: row.columnName!,
            stateType: row.stateType!,
            archived: row.archived,
          };
    }),
    total: counted[0]?.total ?? 0,
  };
}
