import { db, project } from '@repo/db';
import { and, asc, eq } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import { copyIncludeKeys, copyProject } from '#modules/projects/copy';
import { copySections } from '#modules/projects/copy-extension';
import {
  deleteProject,
  getProjectById,
  projectFeatures,
  type ProjectFeatures,
  type ProjectRow,
} from '#modules/projects/service';
import { teamOwnsProject } from '#modules/teams/service';
import { listColumns, type ColumnRow } from '#modules/columns/service';
import { listIssueTypes, type IssueTypeRow } from '#modules/issue-types/service';
import {
  listLabelGroups,
  listLabels,
  type LabelGroupRow,
  type LabelRow,
} from '#modules/labels/service';
import { listCustomFields, type CustomFieldRow } from '#modules/custom-fields/service';
import { listIssueTemplates, type IssueTemplateRow } from '#modules/issue-templates/service';
import { listViews, type UserViewRow } from '#modules/views/service';
import { listDashboards, type DashboardRow } from '#modules/dashboards/service';
import { listActions, type ActionRow } from '#modules/actions/service';

export interface ProjectTemplate {
  id: number;
  name: string;
  description: string;
  createdAt: string;
}

export async function listProjectTemplates(teamId: number): Promise<ProjectTemplate[]> {
  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(and(eq(project.teamId, teamId), eq(project.isTemplate, true)))
    .orderBy(asc(project.name), asc(project.id));
  return rows.map((row) => ({ ...row, createdAt: iso(row.createdAt) }));
}

// A template is a project, so it takes a key unique in its team. Nobody sees the key,
// so it is random; the leading letter keeps it a valid project key.
function templateKey(): string {
  return `T${crypto.randomUUID().replaceAll('-', '').slice(0, 9).toUpperCase()}`;
}

// Saves a copy of the project's configuration as a template. Later changes to the
// project do not reach the template.
export async function saveProjectTemplate(
  teamId: number,
  input: {
    projectId: number;
    name: string;
    description?: string;
    include?: Record<string, boolean | undefined>;
  },
  userId: string,
): Promise<ProjectTemplate> {
  if (!(await teamOwnsProject(teamId, input.projectId))) {
    throw new HttpError(404, 'Project not found');
  }
  const saved = await copyProject(
    input.projectId,
    { key: templateKey(), name: input.name, description: input.description },
    userId,
    teamId,
    input.include,
    { template: true },
  );
  return {
    id: saved.id,
    name: saved.name,
    description: saved.description,
    createdAt: saved.createdAt,
  };
}

// What a template holds, read the way a project's own settings read it.
export interface ProjectTemplateDetail extends ProjectTemplate {
  columns: ColumnRow[];
  issueTypes: IssueTypeRow[];
  labels: LabelRow[];
  labelGroups: LabelGroupRow[];
  customFields: CustomFieldRow[];
  issueTemplates: IssueTemplateRow[];
  views: UserViewRow[];
  dashboards: DashboardRow[];
  actions: ActionRow[];
  features: ProjectFeatures;
  estimates: { points: boolean; time: boolean; logging: boolean };
  sections: { key: string; items: string[] }[];
}

export async function getProjectTemplate(
  teamId: number,
  templateId: number,
  userId: string,
): Promise<ProjectTemplateDetail> {
  await requireTemplate(teamId, templateId);
  const [
    found,
    columns,
    issueTypes,
    labels,
    labelGroups,
    customFields,
    issueTemplates,
    views,
    dashboards,
    actions,
    sections,
  ] = await Promise.all([
    getProjectById(templateId),
    listColumns(templateId),
    listIssueTypes(templateId),
    listLabels(templateId),
    listLabelGroups(templateId),
    listCustomFields(templateId, { allTypes: true }),
    listIssueTemplates(templateId),
    listViews(templateId, userId),
    listDashboards(templateId),
    listActions(templateId),
    Promise.all(
      copySections()
        .filter((section) => section.template)
        .map(async (section) => ({
          key: section.key,
          items: await section.contents(templateId),
        })),
    ),
  ]);
  const template = found!;
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    createdAt: template.createdAt,
    columns,
    issueTypes,
    labels,
    labelGroups,
    customFields,
    issueTemplates,
    views,
    dashboards,
    actions,
    features: projectFeatures(template),
    estimates: {
      points: template.pointsEstimateEnabled,
      time: template.timeEstimateEnabled,
      logging: template.timeLoggingEnabled,
    },
    sections,
  };
}

async function requireTemplate(teamId: number, templateId: number): Promise<void> {
  const [row] = await db
    .select({ id: project.id })
    .from(project)
    .where(
      and(eq(project.id, templateId), eq(project.teamId, teamId), eq(project.isTemplate, true)),
    );
  if (!row) throw new HttpError(404, 'Project template not found');
}

export async function createProjectFromTemplate(
  teamId: number,
  templateId: number,
  input: { key: string; name: string; description?: string },
  userId: string,
): Promise<ProjectRow> {
  await requireTemplate(teamId, templateId);
  // A template holds only what was chosen when it was saved, so the project takes all of it.
  const everything = Object.fromEntries(copyIncludeKeys().map((key) => [key, true]));
  return copyProject(templateId, input, userId, teamId, everything, { defaultAgents: true });
}

export async function deleteProjectTemplate(teamId: number, templateId: number): Promise<void> {
  await requireTemplate(teamId, templateId);
  await deleteProject(templateId);
}
