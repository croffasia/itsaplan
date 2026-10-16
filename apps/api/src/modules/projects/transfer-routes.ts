import { Elysia } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser } from '#shared/access';
import { isMcpRequest } from '#shared/mcp-request';
import { commonErrors, errors } from '#shared/responses';
import { ProjectResponse } from './model';
import {
  ProjectTransferPreviewResponse,
  previewProjectTransferBody,
  transferProjectBody,
} from './transfer-model';
import { previewProjectTransfer, transferProject } from './transfer';

export const projectTransfers = new Elysia({
  name: 'project-transfers',
  detail: { tags: ['Projects'] },
})
  .use(authContext)
  .use(guards)
  .post(
    '/projects/:projectKey/transfer/preview',
    ({ project, body, user, request }) =>
      previewProjectTransfer(
        project.id,
        body.targetTeamId,
        requireUser(user).id,
        isMcpRequest(request.headers),
      ),
    {
      teamRunsProject: true,
      body: previewProjectTransferBody,
      response: { 200: ProjectTransferPreviewResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Preview a project transfer',
        description:
          'Check a move within the same workspace. Requires an owner or manager of both teams. Reports blockers, required role mappings, destination feature availability and changed notification providers. Makes no changes. Keep projectId for transfer_project.',
        ...mcpTool('preview_project_transfer', {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
        }),
      },
    },
  )
  .post(
    '/projects/:projectKey/transfer',
    ({ params, body, user, request }) =>
      transferProject(params.projectKey, body, requireUser(user).id, isMcpRequest(request.headers)),
    {
      body: transferProjectBody,
      response: { 200: ProjectResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Transfer an existing project to a team',
        description:
          'Move a project within its workspace while preserving its ID, key, work and history. Call preview_project_transfer first. Requires a human owner or manager of both teams and explicit role mappings. projectId and sourceTeamId pin the original project for safe retries. Blocked requests change nothing. Returns the new qualified ref.',
        ...mcpTool('transfer_project', {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
        }),
      },
    },
  );
