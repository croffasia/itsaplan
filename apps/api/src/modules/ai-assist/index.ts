import { Elysia } from 'elysia';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { assertPermission, requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { teamParams } from '#modules/teams/model';
import { getIssue, getIssueProjectId } from '#modules/issues/service';
import { getProjectById } from '#modules/projects/service';
import { ChecklistResponse, issueParams } from '#modules/issues/model';
import {
  AiAssistSettingsResponse,
  AiAssistStatusResponse,
  BoardApplyResponse,
  BoardDraft,
  ChecklistDraft,
  aiAssistSettingsBody,
  boardPromptBody,
} from './model';
import {
  applyBoard,
  applyChecklist,
  draftBoard,
  draftChecklist,
  getAiAssistSettings,
  setAiAssistSettings,
} from './service';
import { takeAiAssistCall } from './rate-limit';

async function teamOfProject(projectId: number): Promise<number> {
  const project = await getProjectById(projectId);
  if (!project) throw new HttpError(404, 'Project not found');
  return project.teamId;
}

// Quick AI features on the team's own model credential. A draft route only asks the
// model and writes nothing; its apply route creates what the person confirmed through
// the same services the plain routes use. With no credential picked, the draft routes
// answer 409; past the per-user hourly limit, 429.
export const aiAssistRoutes = new Elysia({ name: 'ai-assist', detail: { tags: ['AI Assist'] } })
  .use(authContext)
  .use(guards)
  .macro({
    issueChecklist: entityGuard(
      'work_items',
      'Issue not found',
      (p) => getIssueProjectId(Number(p.issueId)),
      'checklists',
    ),
  })

  .get('/teams/:teamId/ai-assist', ({ params }) => getAiAssistSettings(params.teamId), {
    params: teamParams,
    teamMember: true,
    response: { 200: AiAssistSettingsResponse, ...accessErrors },
    detail: { summary: 'Get the AI assist model of a team' },
  })

  .put('/teams/:teamId/ai-assist', ({ params, body }) => setAiAssistSettings(params.teamId, body), {
    params: teamParams,
    body: aiAssistSettingsBody,
    teamManager: true,
    response: { 200: AiAssistSettingsResponse, ...commonErrors },
    detail: {
      summary: 'Set the AI assist model of a team',
      description:
        'Pick the LLM credential and model AI assist runs on; a null credential turns it off.',
    },
  })

  .get(
    '/projects/:projectKey/ai',
    async ({ project }) => ({
      enabled: (await getAiAssistSettings(project.teamId)).credentialId != null,
    }),
    {
      projectMember: true,
      response: { 200: AiAssistStatusResponse, ...accessErrors },
      detail: { summary: 'Whether AI assist is on for a project' },
    },
  )

  .post(
    '/projects/:projectKey/ai/board',
    ({ project, body, user }) => {
      takeAiAssistCall(requireUser(user).id);
      return draftBoard(project, body.prompt);
    },
    {
      body: boardPromptBody,
      permission: ['work_items', 'create'],
      response: { 200: BoardDraft, ...commonErrors, ...errors(409, 429, 502) },
      detail: {
        summary: 'Draft a board with AI',
        description: 'Propose columns and issues for a prompt. Nothing is created.',
      },
    },
  )

  .post(
    '/projects/:projectKey/ai/board/apply',
    async ({ project, body, user, set }) => {
      await assertPermission(project.id, user, 'work_items', 'create');
      set.status = 201;
      return applyBoard(project, body, requireUser(user).id);
    },
    {
      body: BoardDraft,
      permission: ['states', 'create'],
      response: { 201: BoardApplyResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Create a drafted board',
        description: 'Create the confirmed columns and issues of a board draft.',
      },
    },
  )

  .post(
    '/issues/:issueId/ai/checklist',
    async ({ params, projectId, user }) => {
      takeAiAssistCall(requireUser(user).id);
      const issue = (await getIssue(params.issueId))!;
      return draftChecklist(await teamOfProject(projectId), issue);
    },
    {
      params: issueParams,
      issueChecklist: 'edit',
      response: { 200: ChecklistDraft, ...accessErrors, ...errors(409, 429, 502) },
      detail: {
        summary: 'Suggest a checklist with AI',
        description: "Propose checklist steps from the issue's title and description.",
      },
    },
  )

  .post(
    '/issues/:issueId/ai/checklist/apply',
    async ({ params, body, user, set }) => {
      set.status = 201;
      return applyChecklist(params.issueId, body, requireUser(user).id);
    },
    {
      params: issueParams,
      body: ChecklistDraft,
      issueChecklist: 'edit',
      response: { 201: ChecklistResponse, ...commonErrors },
      detail: { summary: 'Add a suggested checklist' },
    },
  );
