import { Elysia } from 'elysia';
import { db } from '@repo/db';
import { projectMember } from '@repo/db/schema';
import { and, eq } from 'drizzle-orm';
import { mcpTool } from '#mcp/generate';
import { requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { commonErrors } from '#shared/responses';
import { ProjectPreferencesResponse, updateProjectPreferencesBody } from './model';

async function updatePreferences(
  projectId: number,
  userId: string,
  preferences: typeof updateProjectPreferencesBody.static,
) {
  const [updated] = await db
    .update(projectMember)
    .set(preferences)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
    .returning({ isFavorite: projectMember.isFavorite, isHidden: projectMember.isHidden });
  if (!updated) throw new HttpError(403, 'Only a member of the project keeps preferences for it');
  return updated;
}

export const projectPreferences = new Elysia({
  name: 'project-preferences',
  detail: { tags: ['Projects'] },
})
  .use(authContext)
  .use(guards)
  .patch(
    '/projects/:projectKey/preferences',
    ({ project, user, body }) => updatePreferences(project.id, requireUser(user).id, body),
    {
      body: updateProjectPreferencesBody,
      projectMember: true,
      response: { 200: ProjectPreferencesResponse, ...commonErrors },
      detail: {
        summary: 'Update your project preferences',
        description:
          'Set isFavorite or isHidden on a project, for you only. A hidden project stays ' +
          'accessible and stays in list_projects. Send at ' +
          'least one field. Omitted fields do not change.',
        ...mcpTool('update_project_preferences'),
      },
    },
  );
