import { Elysia } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { isMcpRequest } from '#shared/mcp-request';
import { paginate } from '#shared/pagination';
import { errors } from '#shared/responses';
import { workspaceSearchQuery, WorkspaceSearchResponse } from './model';
import { searchWorkspace } from './service';

export const discoveryRoutes = new Elysia({
  name: 'discovery',
  detail: { tags: ['Discovery'] },
})
  .use(authContext)
  .get(
    '/discovery/search',
    ({ user, request, query }) =>
      paginate(query, (window) =>
        searchWorkspace(requireUser(user).id, query, window, {
          mcpOnly: isMcpRequest(request.headers),
        }),
      ),
    {
      query: workspaceSearchQuery,
      response: { 200: WorkspaceSearchResponse, ...errors(400, 401) },
      detail: {
        summary: 'Search projects and tasks across the workspace',
        description:
          'Find projects (task boards) and issues (tasks) without knowing the project key. ' +
          'Matches every search term across names, keys, issue identifiers, and descriptions. ' +
          'Returns compact references, with exact keys and identifiers first, then title and name matches before description matches. Issues include archived matches and their current state. ' +
          'Only searches projects and work items you may read. Use get_issue for full task content, ' +
          "get_project for project setup, or list_note_boards for a project's separate note canvases.",
        ...mcpTool('search_workspace'),
      },
    },
  );
