import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { HttpError, rethrowDuplicate } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import {
  GroupResponse,
  createGroupBody,
  groupMemberParams,
  groupMembersBody,
  groupParams,
  groupsParams,
  updateGroupBody,
} from './model';
import {
  addGroupMembers,
  createGroup,
  deleteGroup,
  listGroups,
  removeGroupMember,
  setGroupMembers,
  updateGroup,
} from './service';

export const groupRoutes = new Elysia({ name: 'groups', detail: { tags: ['Groups'] } })
  .use(guards)
  .get('/projects/:projectKey/groups', ({ project }) => listGroups(project.id), {
    params: groupsParams,
    projectMember: true,
    response: { 200: t.Array(GroupResponse), ...accessErrors },
    detail: {
      summary: 'List assignee groups',
      description:
        'List the groups of project members an issue can be assigned to, with their member ids.',
      ...mcpTool('list_groups'),
    },
  })

  .post(
    '/projects/:projectKey/groups',
    async ({ project, body, set }) => {
      try {
        set.status = 201;
        return await createGroup({ projectId: project.id, ...body });
      } catch (err) {
        rethrowDuplicate(err, 'group');
      }
    },
    {
      params: groupsParams,
      body: createGroupBody,
      permission: ['labels', 'create'],
      response: { 201: GroupResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Create an assignee group',
        description:
          'Create a group of project members. memberIds must all be members of the project.',
        ...mcpTool('create_group'),
      },
    },
  )

  .patch(
    '/projects/:projectKey/groups/:groupId',
    async ({ params, project, body }) => {
      let group;
      try {
        group = await updateGroup(params.groupId, project.id, body);
      } catch (err) {
        rethrowDuplicate(err, 'group');
      }
      if (!group) throw new HttpError(404, 'Group not found');
      return group;
    },
    {
      params: groupParams,
      body: updateGroupBody,
      permission: ['labels', 'edit'],
      response: { 200: GroupResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Update an assignee group',
        description: "Update a group's name, color, or position.",
        ...mcpTool('update_group'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/groups/:groupId',
    async ({ params, project }) => {
      await deleteGroup(params.groupId, project.id);
      return noContent();
    },
    {
      params: groupParams,
      permission: ['labels', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an assignee group',
        description: 'Delete a group. Issues assigned to it become unassigned from the group.',
        ...mcpTool('delete_group'),
      },
    },
  )

  .put(
    '/projects/:projectKey/groups/:groupId/members',
    async ({ params, project, body }) => {
      const group = await setGroupMembers(params.groupId, project.id, body.userIds);
      if (!group) throw new HttpError(404, 'Group not found');
      return group;
    },
    {
      params: groupParams,
      body: groupMembersBody,
      permission: ['labels', 'edit'],
      response: { 200: GroupResponse, ...commonErrors },
      detail: {
        summary: 'Set the members of an assignee group',
        description:
          'Replace the whole member list of a group. Every user must be a project member.',
        ...mcpTool('set_group_members'),
      },
    },
  )

  .post(
    '/projects/:projectKey/groups/:groupId/members',
    async ({ params, project, body }) => {
      const group = await addGroupMembers(params.groupId, project.id, body.userIds);
      if (!group) throw new HttpError(404, 'Group not found');
      return group;
    },
    {
      params: groupParams,
      body: groupMembersBody,
      permission: ['labels', 'edit'],
      response: { 200: GroupResponse, ...commonErrors },
      detail: {
        summary: 'Add members to an assignee group',
        description: 'Add project members to a group. Users already in it are kept.',
        ...mcpTool('add_group_members'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/groups/:groupId/members/:userId',
    async ({ params, project }) => {
      const group = await removeGroupMember(params.groupId, project.id, params.userId);
      if (!group) throw new HttpError(404, 'Group not found');
      return noContent();
    },
    {
      params: groupMemberParams,
      permission: ['labels', 'edit'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Remove a member from an assignee group',
        description: 'Remove one user from a group.',
        ...mcpTool('remove_group_member'),
      },
    },
  );
