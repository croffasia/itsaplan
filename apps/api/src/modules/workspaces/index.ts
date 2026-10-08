import { Elysia, t } from 'elysia';
import { getScimSettings, rotateScimToken, setScimSettings } from '@repo/auth';
import { requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { errors } from '#shared/responses';
import { SCIM_BASE_URL } from '#modules/scim/resource';
import {
  ScimGroupMappingsBody,
  ScimGroupResponse,
  ScimSettingsBody,
  ScimSettingsResponse,
  ScimTokenResponse,
  WorkspaceCandidateListResponse,
  WorkspaceListResponse,
  WorkspaceManagerListResponse,
  WorkspaceProjectOptionListResponse,
  WorkspaceResponse,
  addManagerBody,
  scimGroupParams,
  searchQuery,
  updateWorkspaceBody,
  workspaceManagerParams,
  workspaceParams,
} from './model';
import {
  addAdmin,
  deleteWorkspace,
  getWorkspace,
  listManagerCandidates,
  listManagers,
  listWorkspaces,
  removeAdmin,
  updateWorkspace,
} from './service';
import {
  listWorkspaceProjectOptions,
  listWorkspaceScimGroups,
  setWorkspaceScimGroupMappings,
} from './scim';

// A workspace owns teams. Only its owner and admins manage it; everyone else sees it
// through the teams they are in. No route creates one: sign-up and sign-in make each
// person's own (@repo/auth), and an edition that lets a person own more mounts its route
// on createOwnWorkspace. SCIM provisioning is set up only by the instance owner, in a
// workspace they own: the identity provider decides who has access to the workspace.
export const workspaceRoutes = new Elysia({ name: 'workspaces', detail: { tags: ['Workspaces'] } })
  .use(authContext)
  .use(guards)

  .get('/workspaces', ({ user }) => listWorkspaces(requireUser(user).id), {
    response: { 200: WorkspaceListResponse, ...errors(401) },
    detail: {
      summary: 'List workspaces',
      description: 'The workspaces you manage or hold a team in, with your standing in each.',
    },
  })

  .get(
    '/workspaces/:workspaceId',
    ({ standing }) => getWorkspace(standing.workspaceId, standing.role),
    {
      workspaceManager: true,
      params: workspaceParams,
      response: { 200: WorkspaceResponse, ...errors(401, 404) },
      detail: { summary: 'Get a workspace', description: 'A workspace you manage.' },
    },
  )

  .patch(
    '/workspaces/:workspaceId',
    async ({ standing, body }) => {
      await updateWorkspace(standing.workspaceId, standing.role, body);
      return getWorkspace(standing.workspaceId, standing.role);
    },
    {
      workspaceManager: true,
      params: workspaceParams,
      body: updateWorkspaceBody,
      response: { 200: WorkspaceResponse, ...errors(400, 401, 403, 404) },
      detail: {
        summary: 'Update a workspace',
        description:
          'Rename or recolour a workspace you manage. Who creates teams in it is set by its ' +
          'owner only.',
      },
    },
  )

  .delete(
    '/workspaces/:workspaceId',
    async ({ standing }) => {
      await deleteWorkspace(standing.workspaceId, standing.userId);
      return noContent();
    },
    {
      workspaceOwner: true,
      params: workspaceParams,
      response: { 204: t.Void(), ...errors(401, 403, 404, 409) },
      detail: {
        summary: 'Delete a workspace',
        description:
          'Delete a workspace you own, with its teams. The instance workspace stays, and one ' +
          'whose teams hold a project or an AI agent is refused until those are gone.',
      },
    },
  )

  .get('/workspaces/:workspaceId/managers', ({ standing }) => listManagers(standing.workspaceId), {
    workspaceManager: true,
    params: workspaceParams,
    response: { 200: WorkspaceManagerListResponse, ...errors(401, 404) },
    detail: { summary: 'List workspace managers', description: 'The owner, then the admins.' },
  })

  .get(
    '/workspaces/:workspaceId/managers/candidates',
    ({ standing, query }) => listManagerCandidates(standing.workspaceId, query.search),
    {
      workspaceManager: true,
      params: workspaceParams,
      query: searchQuery,
      response: { 200: WorkspaceCandidateListResponse, ...errors(401, 404) },
      detail: {
        summary: 'List workspace admin candidates',
        description:
          'Up to 20 people in a team of the workspace who do not manage it yet, by name.',
      },
    },
  )

  .post(
    '/workspaces/:workspaceId/managers',
    async ({ standing, body, set }) => {
      await addAdmin(standing.workspaceId, body.userId);
      set.status = 201;
      return listManagers(standing.workspaceId);
    },
    {
      workspaceOwner: true,
      params: workspaceParams,
      body: addManagerBody,
      response: { 201: WorkspaceManagerListResponse, ...errors(400, 401, 403, 404, 409) },
      detail: {
        summary: 'Add a workspace admin',
        description: 'Make a person in a team of the workspace its admin. Owner only.',
      },
    },
  )

  .delete(
    '/workspaces/:workspaceId/managers/:userId',
    async ({ standing, params }) => {
      await removeAdmin(standing.workspaceId, params.userId);
      return noContent();
    },
    {
      workspaceOwner: true,
      params: workspaceManagerParams,
      response: { 204: t.Void(), ...errors(401, 403, 404, 409) },
      detail: {
        summary: 'Remove a workspace admin',
        description: 'Take the admin standing from a person. The owner cannot be removed.',
      },
    },
  )

  .get(
    '/workspaces/:workspaceId/scim',
    async ({ standing }) => ({
      ...(await getScimSettings(standing.workspaceId)),
      baseUrl: SCIM_BASE_URL,
    }),
    {
      workspaceScim: true,
      params: workspaceParams,
      response: { 200: ScimSettingsResponse, ...errors(401, 403, 404) },
      detail: {
        summary: 'Get SCIM provisioning settings',
        description:
          'Whether SCIM provisioning is on and whether a token has been generated. ' +
          'Instance owner only.',
      },
    },
  )

  .patch(
    '/workspaces/:workspaceId/scim',
    async ({ standing, body }) => {
      const current = await getScimSettings(standing.workspaceId);
      // Enabling it without a token would leave the endpoint answering 401 to
      // everything, which reads as a broken integration rather than a missing step.
      if (body.enabled && !current.hasToken) {
        throw new HttpError(400, 'Generate a SCIM token first');
      }
      return { ...(await setScimSettings(standing.workspaceId, body)), baseUrl: SCIM_BASE_URL };
    },
    {
      workspaceScim: true,
      params: workspaceParams,
      body: ScimSettingsBody,
      response: { 200: ScimSettingsResponse, ...errors(400, 401, 403, 404) },
      detail: {
        summary: 'Update SCIM provisioning settings',
        description: 'Turn SCIM provisioning on or off. Instance owner only.',
      },
    },
  )

  .post(
    '/workspaces/:workspaceId/scim/token',
    async ({ standing }) => ({ token: await rotateScimToken(standing.workspaceId) }),
    {
      workspaceScim: true,
      params: workspaceParams,
      response: { 200: ScimTokenResponse, ...errors(401, 403, 404) },
      detail: {
        summary: 'Generate a SCIM token',
        description:
          'Generate the bearer token an identity provider sends to /scim/v2, replacing any ' +
          'previous one. The value is returned once and cannot be read back. Instance owner only.',
      },
    },
  )

  .get(
    '/workspaces/:workspaceId/scim/groups',
    ({ standing }) => listWorkspaceScimGroups(standing.workspaceId),
    {
      workspaceScim: true,
      params: workspaceParams,
      response: { 200: t.Array(ScimGroupResponse), ...errors(401, 403, 404) },
      detail: {
        summary: 'List provisioned groups',
        description:
          "The groups the workspace's identity provider has pushed, with their member counts " +
          'and the projects they grant membership in. Instance owner only.',
      },
    },
  )

  .put(
    '/workspaces/:workspaceId/scim/groups/:groupId/mappings',
    ({ standing, params, body }) =>
      setWorkspaceScimGroupMappings(standing.workspaceId, params.groupId, body.mappings),
    {
      workspaceScim: true,
      params: scimGroupParams,
      body: ScimGroupMappingsBody,
      response: { 200: ScimGroupResponse, ...errors(400, 401, 403, 404) },
      detail: {
        summary: "Set a group's project mappings",
        description:
          'Replace the projects of the workspace a provisioned group grants membership in, ' +
          'then reconcile the membership of every project the change touched. Instance owner only.',
      },
    },
  )

  .get(
    '/workspaces/:workspaceId/projects/options',
    ({ standing }) => listWorkspaceProjectOptions(standing.workspaceId),
    {
      workspaceScim: true,
      params: workspaceParams,
      response: { 200: WorkspaceProjectOptionListResponse, ...errors(401, 403, 404) },
      detail: {
        summary: 'List workspace projects',
        description:
          'Every project of the workspace with the roles its team assigns, for the group ' +
          'mapping picker. Instance owner only.',
      },
    },
  );
