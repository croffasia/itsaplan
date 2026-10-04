// SCIM 2.0 provisioning tables. An identity provider pushes users and groups to
// /scim/v2 in the API; an account is one `user` row across the instance, and what a
// workspace's provider knows about it lands here, as do its groups.
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';
import { project, teamRole, workspace } from './app';

// An account as the identity provider of one workspace sees it. The provider decides
// who has the workspace, not who has an account: `active` false means the person was
// taken out of the workspace's teams and its groups grant them nothing, and the account
// itself is untouched. Every workspace's provider keeps its own row for the same person.
export const scimUser = pgTable(
  'scim_user',
  {
    workspaceId: integer('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // The provider's own id for the person, sent as `externalId`.
    externalId: text('external_id'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index('scim_user_user_idx').on(t.userId),
  ],
);

// A group as the identity provider of one workspace sees it. Written only over SCIM:
// the group list and its members are the provider's, and the workspace settings show
// them read-only.
export const scimGroup = pgTable(
  'scim_group',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: integer('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    // The provider's own id for the group, sent as `externalId` and used to find a
    // group again after it is renamed.
    externalId: text('external_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.workspaceId, t.displayName)],
);

export const scimGroupMember = pgTable(
  'scim_group_member',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => scimGroup.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index('scim_group_member_user_idx').on(t.userId),
  ],
);

// What a group grants. A SCIM group carries only a name and a member list, so the
// workspace owner declares that group X makes its members part of project Y of the
// same workspace at role Z. One group may map to several projects; at most one
// mapping per pair.
// `role_id` names the team_role a "member" joins on, and is NULL for an owner (an
// owner bypasses the permission matrix) or when the team's default role applies.
export const scimGroupMapping = pgTable(
  'scim_group_mapping',
  {
    id: serial('id').primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => scimGroup.id, { onDelete: 'cascade' }),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    roleId: integer('role_id').references(() => teamRole.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.groupId, t.projectId),
    check('scim_group_mapping_role_check', sql`${t.role} IN ('owner', 'member')`),
    index('scim_group_mapping_project_idx').on(t.projectId),
  ],
);
