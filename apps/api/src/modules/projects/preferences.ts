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
  if (!updated) throw new HttpError(403, 'You do not have access to this project');
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
          'Set isFavorite or isHidden for the authenticated caller. These preferences affect only ' +
          "the caller's project navigation. Hiding keeps the project accessible through the API " +
          'and MCP, and it remains in list_projects. Other members and agents retain their own ' +
          'preferences and access. Supply at least one preference; omitted fields remain unchanged.',
        ...mcpTool('update_project_preferences'),
      },
    },
  );
