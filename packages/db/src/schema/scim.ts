// SCIM 2.0 provisioning tables. An identity provider pushes users and groups to
// /scim/v2 in the API; users land on the `user` table, groups land here.
import {
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
import { project, projectRole } from './app';

// A group as the identity provider sees it. Written only over SCIM: the group list
// and its members are the provider's, and god mode shows them read-only.
export const scimGroup = pgTable('scim_group', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull().unique(),
  // The provider's own id for the group, sent as `externalId` and used to find a
  // group again after it is renamed.
  externalId: text('external_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

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
// instance owner declares in god mode that group X makes its members part of project
// Y at role Z. One group may map to several projects; at most one mapping per pair.
// `role_id` names the project_role a "member" joins on, and is NULL for an owner (an
// owner bypasses the permission matrix) or when the project's default role applies.
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
    roleId: integer('role_id').references(() => projectRole.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.groupId, t.projectId),
    check('scim_group_mapping_role_check', sql`${t.role} IN ('owner', 'member')`),
    index('scim_group_mapping_project_idx').on(t.projectId),
  ],
);
