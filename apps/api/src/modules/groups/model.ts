import { t } from 'elysia';

export const groupsParams = t.Object({ projectKey: t.String() });
export const groupParams = t.Object({ projectKey: t.String(), groupId: t.Numeric() });
export const groupMemberParams = t.Object({
  projectKey: t.String(),
  groupId: t.Numeric(),
  userId: t.String(),
});

// A project group DTO (GroupRow from the service): its members are user ids.
export const GroupResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  color: t.String(),
  position: t.Number(),
  memberIds: t.Array(t.String()),
});

export const createGroupBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  color: t.Optional(t.String()),
  position: t.Optional(t.Number()),
  memberIds: t.Optional(
    t.Array(t.String(), { description: 'User ids of project members to put in the group.' }),
  ),
});

export const updateGroupBody = t.Partial(
  t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    color: t.String(),
    position: t.Number(),
  }),
);

export const groupMembersBody = t.Object({
  userIds: t.Array(t.String(), { description: 'User ids of project members.' }),
});
