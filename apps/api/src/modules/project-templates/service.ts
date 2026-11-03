import { db, project, projectTemplate, projectTemplateTeam, team, teamWorkspaceId } from '@repo/db';
import { and, asc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import { getProjectDefaults } from '#modules/settings/service';
import {
  insertSnapshotProject,
  readTemplateSnapshot,
  type ProjectSnapshot,
} from '#modules/projects/copy';
import { copySections } from '#modules/projects/copy-extension';
import {
  defaultAgentMembers,
  projectFeatures,
  targetTeam,
  type EstimateSettings,
  type ProjectFeatures,
  type ProjectRow,
} from '#modules/projects/service';

export interface ProjectTemplate {
  id: number;
  name: string;
  description: string;
  // Null when every team of the workspace sees it.
  teamIds: number[] | null;
  createdAt: string;
}

type TemplateRow = typeof projectTemplate.$inferSelect;

async function withTeams(rows: TemplateRow[]): Promise<ProjectTemplate[]> {
  const limited = rows.filter((row) => !row.allTeams).map((row) => row.id);
  const links = limited.length
    ? await db
        .select()
        .from(projectTemplateTeam)
        .where(inArray(projectTemplateTeam.templateId, limited))
    : [];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    teamIds: row.allTeams
      ? null
      : links.filter((link) => link.templateId === row.id).map((link) => link.teamId),
    createdAt: iso(row.createdAt),
  }));
}

// The templates of the team's workspace that the team sees.
async function teamTemplatesWhere(teamId: number): Promise<SQL> {
  return and(
    eq(projectTemplate.workspaceId, await teamWorkspaceId(teamId, db)),
    or(
      eq(projectTemplate.allTeams, true),
      sql`exists (select 1 from ${projectTemplateTeam} where ${projectTemplateTeam.templateId} = ${projectTemplate.id} and ${projectTemplateTeam.teamId} = ${teamId})`,
    ),
  )!;
}

async function readTemplates(where: SQL): Promise<TemplateRow[]> {
  return db
    .select()
    .from(projectTemplate)
    .where(where)
    .orderBy(asc(projectTemplate.name), asc(projectTemplate.id));
}

// A template of the workspace with its page in the gallery, null while it is not published.
export interface WorkspaceProjectTemplate extends ProjectTemplate {
  publication: { url: string; publishedAt: string } | null;
}

export async function listWorkspaceTemplates(
  workspaceId: number,
): Promise<WorkspaceProjectTemplate[]> {
  const rows = await readTemplates(eq(projectTemplate.workspaceId, workspaceId));
  const templates = await withTeams(rows);
  return templates.map((template, index) => {
    const { publicationUrl, publishedAt } = rows[index];
    return {
      ...template,
      publication:
        publicationUrl && publishedAt
          ? { url: publicationUrl, publishedAt: iso(publishedAt) }
          : null,
    };
  });
}

export async function listTeamTemplates(teamId: number): Promise<ProjectTemplate[]> {
  return withTeams(await readTemplates(await teamTemplatesWhere(teamId)));
}

async function requireTemplate(where: SQL, templateId: number): Promise<TemplateRow> {
  const [row] = await readTemplates(and(where, eq(projectTemplate.id, templateId))!);
  if (!row) throw new HttpError(404, 'Project template not found');
  return row;
}

export function requireWorkspaceTemplate(
  workspaceId: number,
  templateId: number,
): Promise<TemplateRow> {
  return requireTemplate(eq(projectTemplate.workspaceId, workspaceId), templateId);
}

// What a template holds: the project sections and the estimates its flags turn on, and what
// each extension section holds.
export interface ProjectTemplateContents extends Omit<ProjectSnapshot, 'flags' | 'sections'> {
  features: ProjectFeatures;
  estimates: EstimateSettings;
  sections: { key: string; items: string[] }[];
}

export type ProjectTemplateDetail = ProjectTemplate & ProjectTemplateContents;

export function templateContents(snapshot: ProjectSnapshot): ProjectTemplateContents {
  const { flags, sections, ...parts } = snapshot;
  return {
    ...parts,
    features: projectFeatures(flags),
    estimates: {
      points: flags.pointsEstimateEnabled,
      time: flags.timeEstimateEnabled,
      logging: flags.timeLoggingEnabled,
    },
    sections: copySections()
      .filter((section) => section.key in sections)
      .map((section) => ({ key: section.key, items: section.contents(sections[section.key]) })),
  };
}

async function templateDetail(row: TemplateRow): Promise<ProjectTemplateDetail> {
  const [template] = await withTeams([row]);
  return { ...template, ...templateContents(row.snapshot as ProjectSnapshot) };
}

export async function getWorkspaceTemplate(
  workspaceId: number,
  templateId: number,
): Promise<ProjectTemplateDetail> {
  return templateDetail(await requireWorkspaceTemplate(workspaceId, templateId));
}

export async function getTeamTemplate(
  teamId: number,
  templateId: number,
): Promise<ProjectTemplateDetail> {
  return templateDetail(await requireTemplate(await teamTemplatesWhere(teamId), templateId));
}

async function assertWorkspaceTeams(workspaceId: number, teamIds: number[]): Promise<void> {
  const teams = await db
    .select({ id: team.id })
    .from(team)
    .where(and(eq(team.workspaceId, workspaceId), inArray(team.id, teamIds)));
  if (teams.length !== teamIds.length) {
    throw new HttpError(400, 'Team not found in this workspace');
  }
}

export async function requireWorkspaceProject(
  workspaceId: number,
  projectId: number,
): Promise<void> {
  const [source] = await db
    .select({ workspaceId: team.workspaceId })
    .from(project)
    .innerJoin(team, eq(team.id, project.teamId))
    .where(eq(project.id, projectId));
  if (source?.workspaceId !== workspaceId) throw new HttpError(404, 'Project not found');
}

// What a template saved from the project with this selection would hold.
export async function previewProjectTemplate(
  workspaceId: number,
  input: { projectId: number; include?: Record<string, boolean | undefined> },
): Promise<ProjectTemplateContents> {
  await requireWorkspaceProject(workspaceId, input.projectId);
  return templateContents(await readTemplateSnapshot(input.projectId, input.include));
}

// Saves a snapshot of the project's configuration as a template of the workspace. Later
// changes to the project do not reach the template.
export async function saveProjectTemplate(
  workspaceId: number,
  input: {
    projectId: number;
    name: string;
    description?: string;
    include?: Record<string, boolean | undefined>;
    teamIds?: number[];
  },
): Promise<ProjectTemplate> {
  await requireWorkspaceProject(workspaceId, input.projectId);
  return createTemplate(
    workspaceId,
    input,
    await readTemplateSnapshot(input.projectId, input.include),
  );
}

// Stores the snapshot as a template of the workspace, open to the teams named or, without
// them, to every team of it.
export async function createTemplate(
  workspaceId: number,
  input: { name: string; description?: string; teamIds?: number[] },
  snapshot: ProjectSnapshot,
): Promise<ProjectTemplate> {
  const teamIds = input.teamIds && [...new Set(input.teamIds)];
  if (teamIds) await assertWorkspaceTeams(workspaceId, teamIds);
  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(projectTemplate)
      .values({
        workspaceId,
        name: input.name,
        description: input.description ?? '',
        snapshot,
        allTeams: !teamIds,
      })
      .returning();
    if (teamIds) {
      await tx
        .insert(projectTemplateTeam)
        .values(teamIds.map((teamId) => ({ templateId: created.id, teamId })));
    }
    return created;
  });
  const [template] = await withTeams([row]);
  return template;
}

// Changes the name, the description and the teams of a template. What it holds stays as
// saved. `teamIds` null opens it to every team of the workspace.
export async function updateProjectTemplate(
  workspaceId: number,
  templateId: number,
  input: { name?: string; description?: string; teamIds?: number[] | null },
): Promise<ProjectTemplate> {
  await requireWorkspaceTemplate(workspaceId, templateId);
  const teamIds = input.teamIds && [...new Set(input.teamIds)];
  if (teamIds) await assertWorkspaceTeams(workspaceId, teamIds);
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(projectTemplate)
      .set({
        name: input.name,
        description: input.description,
        ...(teamIds !== undefined && { allTeams: teamIds === null }),
      })
      .where(eq(projectTemplate.id, templateId))
      .returning();
    if (teamIds !== undefined) {
      await tx.delete(projectTemplateTeam).where(eq(projectTemplateTeam.templateId, templateId));
      if (teamIds) {
        await tx
          .insert(projectTemplateTeam)
          .values(teamIds.map((teamId) => ({ templateId, teamId })));
      }
    }
    return updated;
  });
  const [template] = await withTeams([row]);
  return template;
}

export async function deleteProjectTemplate(
  workspaceId: number,
  templateId: number,
): Promise<void> {
  await requireWorkspaceTemplate(workspaceId, templateId);
  await db.delete(projectTemplate).where(eq(projectTemplate.id, templateId));
}

// A project of the team that starts with what the template holds and with the team's
// default agents, as a created project does.
export async function createProjectFromTemplate(
  teamId: number,
  templateId: number,
  input: { key: string; name: string; description?: string },
  userId: string,
): Promise<ProjectRow> {
  const row = await requireTemplate(await teamTemplatesWhere(teamId), templateId);
  const ownerTeam = await targetTeam(userId, teamId);
  const defaults = await getProjectDefaults();
  const agentMembers = await defaultAgentMembers(ownerTeam);
  const { project } = await db.transaction((tx) =>
    insertSnapshotProject(tx, row.snapshot as ProjectSnapshot, {
      team: ownerTeam,
      input,
      ownerId: userId,
      mcpEnabled: defaults.mcpEnabled,
      agentMembers,
      sameTeam: false,
    }),
  );
  return project;
}
