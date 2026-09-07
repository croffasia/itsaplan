-- The names this migration is about to rewrite, so the report at the end of the file
-- can say what each one became. Roles that the merge below deletes drop out of the
-- report on their own: it joins the snapshot back to the rows that still exist.
CREATE TEMP TABLE "rename_before" AS
SELECT 'roles' AS "kind", "id", "name" FROM "project_role"
UNION ALL SELECT 'skills', "id", "name" FROM "agent_skill"
UNION ALL SELECT 'agents', "id", "username" FROM "ai_agent"
UNION ALL SELECT 'credentials', "id", COALESCE("label", '') FROM "integration_credential";--> statement-breakpoint
-- Counters the report reads after the rows they describe are gone.
CREATE TEMP TABLE "migration_count" ("key" text PRIMARY KEY, "value" integer NOT NULL);--> statement-breakpoint
INSERT INTO "migration_count" VALUES ('movedInvites', (SELECT count(*) FROM "project_invite"));--> statement-breakpoint

CREATE TABLE "team" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"team_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_member_team_id_user_id_pk" PRIMARY KEY("team_id","user_id"),
	CONSTRAINT "team_member_role_check" CHECK ("team_member"."role" IN ('owner', 'manager', 'member'))
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_member_user_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Accounts that existed before teams. Each one gets the team the sign-up hook in
-- @repo/auth now creates: named after the username, owned by that account. Agent bot
-- users are skipped — they never sign in and never own a project.
DO $$
DECLARE
  account record;
  new_team_id integer;
BEGIN
  FOR account IN
    SELECT "id", "username", "name" FROM "user"
    WHERE "email" NOT LIKE '%@agents.local'
    ORDER BY "created_at"
  LOOP
    INSERT INTO "team" ("name")
    VALUES (COALESCE(NULLIF(account."username", ''), account."name"))
    RETURNING "id" INTO new_team_id;
    INSERT INTO "team_member" ("team_id", "user_id", "role")
    VALUES (new_team_id, account."id", 'owner');
  END LOOP;
END $$;--> statement-breakpoint
-- Every project joins the team of the account that owns it. With several owners it is
-- the one who became an owner first; with none left, the team of its earliest member
-- of any role. Agent members carry no team, so they never decide this.
UPDATE "project" p
SET "team_id" = pick."team_id"
FROM (
  SELECT DISTINCT ON (m."project_id") m."project_id", tm."team_id"
  FROM "project_member" m
  JOIN "team_member" tm ON tm."user_id" = m."user_id" AND tm."role" = 'owner'
  ORDER BY m."project_id", (m."role" <> 'owner'), m."created_at", m."user_id"
) pick
WHERE p."id" = pick."project_id";--> statement-breakpoint
-- A project whose members are all gone has no team to join, so it gets one of its own.
DO $$
DECLARE
  orphan record;
  new_team_id integer;
BEGIN
  FOR orphan IN SELECT "id", "name" FROM "project" WHERE "team_id" IS NULL LOOP
    INSERT INTO "team" ("name") VALUES (orphan."name") RETURNING "id" INTO new_team_id;
    UPDATE "project" SET "team_id" = new_team_id WHERE "id" = orphan."id";
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "project" ALTER COLUMN "team_id" SET NOT NULL;

--> statement-breakpoint
ALTER TABLE "project_role" RENAME TO "team_role";--> statement-breakpoint
ALTER TABLE "team_role" DROP CONSTRAINT "project_role_project_id_name_unique";--> statement-breakpoint
ALTER TABLE "ai_agent" DROP CONSTRAINT "ai_agent_role_id_project_role_id_fk";
--> statement-breakpoint
ALTER TABLE "project_invite" DROP CONSTRAINT "project_invite_role_id_project_role_id_fk";
--> statement-breakpoint
ALTER TABLE "project_member" DROP CONSTRAINT "project_member_role_id_project_role_id_fk";
--> statement-breakpoint
ALTER TABLE "scim_group_mapping" DROP CONSTRAINT "scim_group_mapping_role_id_project_role_id_fk";
--> statement-breakpoint
ALTER TABLE "team_role" DROP CONSTRAINT "project_role_project_id_project_id_fk";
--> statement-breakpoint
DROP INDEX "project_role_default_uq";--> statement-breakpoint
DROP INDEX "project_role_project_idx";--> statement-breakpoint
ALTER TABLE "team_role" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "team_role" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint

-- Roles move from the project to the team that owns it, so every project of a team
-- draws on one list. A role keeps its id, which is what project_member.role_id,
-- project_invite.role_id and ai_agent.role_id point at, so only the roles merged
-- below need their references rewritten.
UPDATE "team_role" r SET "team_id" = p."team_id" FROM "project" p WHERE p."id" = r."project_id";--> statement-breakpoint

-- Which default roles were left as the project got them: named "Member" and granting
-- exactly what defaultMemberPermissions() in packages/db/src/permissions.ts granted
-- before members_manage.read and members_invite.read were added to it.
-- issue_templates:read is in the list because migration 0117 mirrors custom_fields
-- onto issue_templates for every role, so an untouched default carries it by here.
-- Those are interchangeable and collapse into one role per team; an edited one is
-- kept as a role of its own.
CREATE TEMP TABLE "role_migration" AS
SELECT r."id",
       r."team_id",
       r."project_id",
       r."is_default"
         AND r."name" = 'Member'
         AND g."grants" @> ARRAY['work_items:create','work_items:edit','work_items:read','work_items:delete','initiatives:create','initiatives:edit','initiatives:read','initiatives:delete','cycles:create','cycles:edit','cycles:read','cycles:delete','dashboards:read','views:read','states:read','issue_types:read','labels:read','ai_agents:read','custom_fields:read','issue_templates:read','note_boards:create','note_boards:edit','note_boards:read','note_boards:delete']
         AND ARRAY['work_items:create','work_items:edit','work_items:read','work_items:delete','initiatives:create','initiatives:edit','initiatives:read','initiatives:delete','cycles:create','cycles:edit','cycles:read','cycles:delete','dashboards:read','views:read','states:read','issue_types:read','labels:read','ai_agents:read','custom_fields:read','issue_templates:read','note_boards:create','note_boards:edit','note_boards:read','note_boards:delete'] @> g."grants"
         AS "is_standard_default"
  FROM "team_role" r
  CROSS JOIN LATERAL (
    SELECT COALESCE(array_agg(res."rkey" || ':' || act."akey"), ARRAY[]::text[]) AS "grants"
      FROM jsonb_each(r."permissions") AS res("rkey", "rval")
      CROSS JOIN LATERAL jsonb_each(
        CASE WHEN jsonb_typeof(res."rval") = 'object' THEN res."rval" ELSE '{}'::jsonb END
      ) AS act("akey", "aval")
     WHERE act."aval" = 'true'::jsonb
  ) g;--> statement-breakpoint

-- The one default role each team keeps: the oldest untouched one.
CREATE TEMP TABLE "team_default" AS
SELECT DISTINCT ON ("team_id") "team_id", "id"
  FROM "role_migration" WHERE "is_standard_default" ORDER BY "team_id", "id";--> statement-breakpoint

-- A team whose projects all edited their default role, and a team with no project at
-- all, gets a fresh one. Every team has exactly one default role from here on.
WITH "created" AS (
  INSERT INTO "team_role" ("team_id", "name", "is_default", "permissions")
  SELECT t."id", 'Member', true, '{"work_items":{"create":true,"edit":true,"read":true,"delete":true},"initiatives":{"create":true,"edit":true,"read":true,"delete":true},"cycles":{"create":true,"edit":true,"read":true,"delete":true},"dashboards":{"create":false,"edit":false,"read":true,"delete":false},"documents":{"create":true,"edit":true,"read":true,"delete":true},"views":{"create":false,"edit":false,"read":true,"delete":false},"members_invite":{"create":false,"edit":false,"read":true,"delete":false},"members_manage":{"create":false,"edit":false,"read":true,"delete":false},"states":{"create":false,"edit":false,"read":true,"delete":false},"issue_types":{"create":false,"edit":false,"read":true,"delete":false},"labels":{"create":false,"edit":false,"read":true,"delete":false},"ai_agents":{"create":false,"edit":false,"read":true,"delete":false},"integrations":{"create":false,"edit":false,"read":false,"delete":false},"agent_skills":{"create":false,"edit":false,"read":false,"delete":false},"agent_tools":{"create":false,"edit":false,"read":false,"delete":false},"custom_fields":{"create":false,"edit":false,"read":true,"delete":false},"issue_templates":{"create":false,"edit":false,"read":true,"delete":false},"workflow_config":{"create":false,"edit":false,"read":false,"delete":false},"actions":{"create":false,"edit":false,"read":false,"delete":false},"webhooks":{"create":false,"edit":false,"read":false,"delete":false},"note_boards":{"create":true,"edit":true,"read":true,"delete":true},"danger_zone":{"create":false,"edit":false,"read":false,"delete":false}}'::jsonb
    FROM "team" t
   WHERE NOT EXISTS (SELECT 1 FROM "team_default" d WHERE d."team_id" = t."id")
  RETURNING "id", "team_id"
)
INSERT INTO "team_default" ("team_id", "id") SELECT "team_id", "id" FROM "created";--> statement-breakpoint

-- Everyone who sat on one of the merged default roles moves to the one the team kept.
UPDATE "project_member" m SET "role_id" = d."id"
  FROM "role_migration" rm JOIN "team_default" d ON d."team_id" = rm."team_id"
 WHERE m."role_id" = rm."id" AND rm."is_standard_default" AND rm."id" <> d."id";--> statement-breakpoint
UPDATE "project_invite" i SET "role_id" = d."id"
  FROM "role_migration" rm JOIN "team_default" d ON d."team_id" = rm."team_id"
 WHERE i."role_id" = rm."id" AND rm."is_standard_default" AND rm."id" <> d."id";--> statement-breakpoint
UPDATE "ai_agent" a SET "role_id" = d."id"
  FROM "role_migration" rm JOIN "team_default" d ON d."team_id" = rm."team_id"
 WHERE a."role_id" = rm."id" AND rm."is_standard_default" AND rm."id" <> d."id";--> statement-breakpoint
UPDATE "scim_group_mapping" g SET "role_id" = d."id"
  FROM "role_migration" rm JOIN "team_default" d ON d."team_id" = rm."team_id"
 WHERE g."role_id" = rm."id" AND rm."is_standard_default" AND rm."id" <> d."id";--> statement-breakpoint
DELETE FROM "team_role" r USING "role_migration" rm, "team_default" d
 WHERE r."id" = rm."id" AND rm."is_standard_default" AND d."team_id" = rm."team_id" AND rm."id" <> d."id";--> statement-breakpoint

-- An edited default role is a role like any other from here on.
UPDATE "team_role" r SET "is_default" = false
 WHERE r."is_default" AND NOT EXISTS (SELECT 1 FROM "team_default" d WHERE d."id" = r."id");--> statement-breakpoint

-- Two projects of the same team could each name a role the same way, which the team
-- cannot. Every side of such a clash takes the name of the project it came from, so
-- both survive and neither name is arbitrary. The team's default role keeps its name.
UPDATE "team_role" r SET "name" = r."name" || ' (' || p."name" || ')'
  FROM "project" p
 WHERE p."id" = r."project_id" AND NOT r."is_default"
   AND EXISTS (
     SELECT 1 FROM "team_role" o
      WHERE o."team_id" = r."team_id" AND o."id" <> r."id" AND o."name" = r."name"
   );--> statement-breakpoint

-- Two projects can also share a name, which leaves the clash unresolved. The project
-- key is unique across the instance, so appending it always settles it.
UPDATE "team_role" r SET "name" = r."name" || ' [' || p."key" || ']'
  FROM "project" p
 WHERE p."id" = r."project_id" AND NOT r."is_default"
   AND EXISTS (
     SELECT 1 FROM "team_role" o
      WHERE o."team_id" = r."team_id" AND o."id" <> r."id" AND o."name" = r."name"
   );--> statement-breakpoint

-- A suffix can land on a name a role already carried — a project named "Web" holding
-- both "Member" and "Member (Web)" ends with two of the latter, and both take the same
-- key next. Numbering what is still equal is what the unique index below stands on;
-- the team's default role sorts first, so it keeps its name.
WITH "numbered" AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "team_id", "name" ORDER BY "is_default" DESC, "id")
           AS "position"
    FROM "team_role"
)
UPDATE "team_role" r SET "name" = r."name" || ' #' || n."position"
  FROM "numbered" n
 WHERE n."id" = r."id" AND n."position" > 1;--> statement-breakpoint

INSERT INTO "migration_count"
SELECT 'mergedRoles', count(*) FROM "role_migration" rm JOIN "team_default" d ON d."team_id" = rm."team_id"
 WHERE rm."is_standard_default" AND rm."id" <> d."id";--> statement-breakpoint
DROP TABLE "role_migration";--> statement-breakpoint
DROP TABLE "team_default";--> statement-breakpoint
ALTER TABLE "team_role" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invite" ADD CONSTRAINT "project_invite_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scim_group_mapping" ADD CONSTRAINT "scim_group_mapping_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_role" ADD CONSTRAINT "team_role_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_role_default_uq" ON "team_role" USING btree ("team_id") WHERE "team_role"."is_default";--> statement-breakpoint
CREATE INDEX "team_role_team_idx" ON "team_role" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "team_role" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "team_role" ADD CONSTRAINT "team_role_team_id_name_unique" UNIQUE("team_id","name");

--> statement-breakpoint
-- Every project member joins the team that owns their project, so a team's member
-- list holds everyone who works in its projects. The project_member row stays: it is
-- what grants access to that project and carries the team role the member works
-- under. A user who is already in the team keeps the role they have there, so an
-- owner stays an owner; everyone else joins as 'member'. Someone in several projects
-- of one team gets a single row, dated by the first of those projects they joined.
-- Agent bot users are skipped — they act through their project_member row alone and
-- never appear in a member list.
INSERT INTO "team_member" ("team_id", "user_id", "role", "created_at")
SELECT p."team_id", m."user_id", 'member', min(m."created_at")
  FROM "project_member" m
  JOIN "project" p ON p."id" = m."project_id"
 WHERE NOT EXISTS (SELECT 1 FROM "ai_agent" a WHERE a."user_id" = m."user_id")
 GROUP BY p."team_id", m."user_id"
ON CONFLICT ("team_id", "user_id") DO NOTHING;

--> statement-breakpoint
CREATE TABLE "team_invite" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"project_id" integer,
	"email" text NOT NULL,
	"team_role" text DEFAULT 'member' NOT NULL,
	"project_role" text,
	"role_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" text,
	"accepted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "team_invite_token_unique" UNIQUE("token"),
	CONSTRAINT "team_invite_team_role_check" CHECK ("team_invite"."team_role" IN ('manager', 'member')),
	CONSTRAINT "team_invite_project_role_check" CHECK (("team_invite"."project_id" IS NULL AND "team_invite"."project_role" IS NULL)
        OR ("team_invite"."project_id" IS NOT NULL AND "team_invite"."project_role" IN ('owner', 'member'))),
	CONSTRAINT "team_invite_status_check" CHECK ("team_invite"."status" IN ('pending', 'accepted', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invite" ADD CONSTRAINT "team_invite_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_invite_team_pending_uq" ON "team_invite" USING btree ("team_id","email") WHERE "team_invite"."status" = 'pending' AND "team_invite"."project_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "team_invite_project_pending_uq" ON "team_invite" USING btree ("project_id","email") WHERE "team_invite"."status" = 'pending' AND "team_invite"."project_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "team_invite_team_idx" ON "team_invite" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_invite_project_idx" ON "team_invite" USING btree ("project_id");--> statement-breakpoint

-- Invites are into a team from here on, so every project invite moves over and keeps
-- its token: a link that was already sent stays valid. It names the project it was
-- created for, and brings its invitee into the team as a plain member.
INSERT INTO "team_invite" (
  "id", "token", "team_id", "project_id", "email", "team_role", "project_role",
  "role_id", "status", "invited_by_user_id", "accepted_by_user_id", "created_at", "responded_at"
)
SELECT i."id", i."token", p."team_id", i."project_id", i."email", 'member', i."role",
       i."role_id", i."status", i."invited_by_user_id", i."accepted_by_user_id",
       i."created_at", i."responded_at"
  FROM "project_invite" i
  JOIN "project" p ON p."id" = i."project_id";--> statement-breakpoint
SELECT setval(
  pg_get_serial_sequence('team_invite', 'id'),
  GREATEST((SELECT COALESCE(max("id"), 0) FROM "team_invite"), 1)
);--> statement-breakpoint
DROP TABLE "project_invite" CASCADE;

--> statement-breakpoint
CREATE TABLE "team_notification_setting" (
	"team_id" integer PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_notification_setting" ADD CONSTRAINT "team_notification_setting_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Notification provider credentials move from the project to the team that owns it.
-- A team whose projects held several configurations keeps the one saved last. The
-- blob is encrypted with the instance key and is copied as it is, without
-- decrypting. project_notification_setting stays behind, out of the schema and read
-- by nothing, so the configurations that lost the merge can still be recovered by
-- hand; a later migration drops it.
INSERT INTO "team_notification_setting" ("team_id", "ciphertext", "iv", "auth_tag", "redacted", "updated_at")
SELECT DISTINCT ON (p."team_id")
       p."team_id", s."ciphertext", s."iv", s."auth_tag", s."redacted", s."updated_at"
  FROM "project_notification_setting" s
  JOIN "project" p ON p."id" = s."project_id"
 ORDER BY p."team_id", s."updated_at" DESC;

--> statement-breakpoint
-- The provider configurations the merge above left behind, named by the project they
-- belonged to, so the report can point at what an operator may want to re-enter.
CREATE TEMP TABLE "dropped_notification_setting" AS
SELECT p."name"
  FROM "project_notification_setting" s
  JOIN "project" p ON p."id" = s."project_id"
  JOIN "team_notification_setting" t ON t."team_id" = p."team_id"
 WHERE (t."ciphertext", t."updated_at") IS DISTINCT FROM (s."ciphertext", s."updated_at");--> statement-breakpoint

DROP INDEX "integration_credential_project_idx";--> statement-breakpoint
ALTER TABLE "integration_credential" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_credential" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "integration_credential" ADD CONSTRAINT "integration_credential_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_credential_team_idx" ON "integration_credential" USING btree ("team_id");--> statement-breakpoint
-- Integration credentials move from the project to the team that owns it. Every
-- credential is kept: two projects of one team that each stored a key for the same
-- integration end up as two credentials of the team, told apart by the project name
-- appended to the label. Credentials that are still indistinguishable after that
-- (several unlabelled ones on the same integration in one project) get a number.
WITH labelled AS (
  SELECT c."id",
         p."team_id" AS team_id,
         c."integration_key" AS integration_key,
         CASE
           WHEN COALESCE(c."label", '') = '' THEN p."name"
           ELSE c."label" || ' (' || p."name" || ')'
         END AS label
    FROM "integration_credential" c
    JOIN "project" p ON p."id" = c."project_id"
), numbered AS (
  SELECT "id", team_id, label,
         ROW_NUMBER() OVER (PARTITION BY team_id, integration_key, label ORDER BY "id") AS position
    FROM labelled
)
UPDATE "integration_credential" c
   SET "team_id" = n.team_id,
       "label" = CASE WHEN n.position = 1 THEN n.label ELSE n.label || ' #' || n.position END
  FROM numbered n
 WHERE n."id" = c."id";--> statement-breakpoint
ALTER TABLE "integration_credential" DROP CONSTRAINT "integration_credential_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "integration_credential" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_credential" DROP COLUMN "project_id";

--> statement-breakpoint
ALTER TABLE "agent_skill" DROP CONSTRAINT "agent_skill_project_id_name_unique";--> statement-breakpoint
DROP INDEX "agent_skill_project_idx";--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "agent_skill" ADD CONSTRAINT "agent_skill_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_skill_team_idx" ON "agent_skill" USING btree ("team_id");--> statement-breakpoint
-- Skills move from the project to the team that owns it, so an agent working in two
-- projects of one team draws on one library. Every skill is kept: two projects of a
-- team that each hold a skill of the same name end up as two skills of the team, told
-- apart by the project name appended to the skill name. Names still equal after that
-- (two projects sharing a name) get a number. s3_prefix and files[].s3Key are left as
-- they are — the prefix is an opaque pointer, and no object moves.
WITH named AS (
  SELECT s."id",
         p."team_id" AS team_id,
         CASE
           WHEN EXISTS (
             SELECT 1 FROM "agent_skill" o
               JOIN "project" op ON op."id" = o."project_id"
              WHERE op."team_id" = p."team_id" AND o."id" <> s."id" AND o."name" = s."name"
           ) THEN s."name" || ' (' || p."name" || ')'
           ELSE s."name"
         END AS name
    FROM "agent_skill" s
    JOIN "project" p ON p."id" = s."project_id"
), numbered AS (
  SELECT "id", team_id, name,
         ROW_NUMBER() OVER (PARTITION BY team_id, name ORDER BY "id") AS position
    FROM named
)
UPDATE "agent_skill" s
   SET "team_id" = n.team_id,
       "name" = CASE WHEN n.position = 1 THEN n.name ELSE n.name || ' #' || n.position END
  FROM numbered n
 WHERE n."id" = s."id";--> statement-breakpoint
ALTER TABLE "agent_skill" DROP CONSTRAINT "agent_skill_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "agent_skill" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_skill" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "agent_skill" ADD CONSTRAINT "agent_skill_team_id_name_unique" UNIQUE("team_id","name");

--> statement-breakpoint
ALTER TABLE "agent_tool" DROP CONSTRAINT "agent_tool_project_id_tool_key_credential_id_unique";--> statement-breakpoint
DROP INDEX "agent_tool_project_idx";--> statement-breakpoint
ALTER TABLE "agent_tool" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "agent_tool" ADD CONSTRAINT "agent_tool_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_tool_team_idx" ON "agent_tool" USING btree ("team_id");--> statement-breakpoint
-- Configured tools move from the project to the team that owns it, because the
-- credential they bind is already the team's. Two projects of one team that bound the
-- same tool to the same credential become one row: the setting is the same, and a
-- configured tool has no name to tell two apart.
UPDATE "agent_tool" t
   SET "team_id" = p."team_id"
  FROM "project" p
 WHERE p."id" = t."project_id";--> statement-breakpoint
-- The agents of the merged rows keep the tool: their links move to the row that
-- survives. An agent belongs to one project, and the old unique constraint held per
-- project, so no agent can end up linked to the survivor twice.
WITH survivor AS (
  SELECT "id", min("id") OVER (PARTITION BY "team_id", "tool_key", "credential_id") AS keep_id
    FROM "agent_tool"
)
UPDATE "agent_tool_link" l
   SET "agent_tool_id" = s.keep_id
  FROM survivor s
 WHERE s."id" = l."agent_tool_id" AND s.keep_id <> s."id";--> statement-breakpoint
INSERT INTO "migration_count"
SELECT 'mergedAgentTools', count(*) FROM (
  SELECT "id", min("id") OVER (PARTITION BY "team_id", "tool_key", "credential_id") AS keep_id
    FROM "agent_tool"
) s WHERE s.keep_id <> s."id";--> statement-breakpoint
DELETE FROM "agent_tool" a
 USING (
   SELECT "id", min("id") OVER (PARTITION BY "team_id", "tool_key", "credential_id") AS keep_id
     FROM "agent_tool"
 ) s
 WHERE s."id" = a."id" AND s.keep_id <> a."id";--> statement-breakpoint
ALTER TABLE "agent_tool" DROP CONSTRAINT "agent_tool_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "agent_tool" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_tool" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "agent_tool" ADD CONSTRAINT "agent_tool_team_id_tool_key_credential_id_unique" UNIQUE("team_id","tool_key","credential_id");

--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD COLUMN "project_id" integer;--> statement-breakpoint
-- A schedule and a run name the project they work in. Until now that project came
-- from the agent, which is about to belong to a team instead, so every existing row
-- takes the project its agent had.
UPDATE "agent_schedule" s SET "project_id" = a."project_id"
  FROM "ai_agent" a WHERE a."id" = s."agent_id";--> statement-breakpoint
UPDATE "agent_run" r SET "project_id" = a."project_id"
  FROM "ai_agent" a WHERE a."id" = r."agent_id";--> statement-breakpoint
ALTER TABLE "agent_run" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_schedule" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD CONSTRAINT "agent_schedule_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_project_idx" ON "agent_run" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_schedule_project_idx" ON "agent_schedule" USING btree ("project_id");

--> statement-breakpoint
DROP INDEX "ai_agent_project_username_uq";--> statement-breakpoint
DROP INDEX "ai_agent_project_idx";--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- An agent moves from the project to the team that owns it, so one agent and one key
-- reach every project of the team. A handle is unique per team now, so two agents that
-- shared one in two projects are told apart by the project key appended to the handle,
-- and by a number when that still collides. Membership in the project each agent works
-- in is written below, so it keeps that project.
WITH named AS (
  SELECT a."id",
         p."team_id" AS team_id,
         CASE
           WHEN EXISTS (
             SELECT 1 FROM "ai_agent" o
               JOIN "project" op ON op."id" = o."project_id"
              WHERE op."team_id" = p."team_id" AND o."id" <> a."id"
                AND lower(o."username") = lower(a."username")
           ) THEN a."username" || '-' || lower(p."key")
           ELSE a."username"
         END AS username
    FROM "ai_agent" a
    JOIN "project" p ON p."id" = a."project_id"
), numbered AS (
  SELECT "id", team_id, username,
         ROW_NUMBER() OVER (PARTITION BY team_id, lower(username) ORDER BY "id") AS position
    FROM named
)
UPDATE "ai_agent" a
   SET "team_id" = n.team_id,
       "username" = CASE WHEN n.position = 1 THEN n.username ELSE n.username || '-' || n.position END
  FROM numbered n
 WHERE n."id" = a."id";--> statement-breakpoint
-- An agent works in the project it was bound to, and membership is what says so now.
-- Agents created before the membership was written get their row here, so nothing
-- depends on the column about to be dropped.
INSERT INTO "project_member" ("project_id", "user_id", "role", "role_id")
SELECT a."project_id", a."user_id", 'member', a."role_id" FROM "ai_agent" a
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "ai_agent" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" DROP CONSTRAINT "ai_agent_project_id_project_id_fk";--> statement-breakpoint
ALTER TABLE "ai_agent" DROP COLUMN "project_id";--> statement-breakpoint
CREATE UNIQUE INDEX "ai_agent_team_username_uq" ON "ai_agent" USING btree ("team_id",lower("username"));--> statement-breakpoint
CREATE INDEX "ai_agent_team_idx" ON "ai_agent" USING btree ("team_id");

--> statement-breakpoint
ALTER TABLE "team_member" DROP CONSTRAINT "team_member_role_check";--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_role_check" CHECK ("team_member"."role" IN ('owner', 'manager', 'member', 'agent'));--> statement-breakpoint
-- Agents belong to the team's member list. The statements above filled team_member
-- from the accounts that existed and skipped the bot users; each agent gets its row
-- here.
INSERT INTO "team_member" ("team_id", "user_id", "role")
SELECT a."team_id", a."user_id", 'agent' FROM "ai_agent" a
ON CONFLICT DO NOTHING;

--> statement-breakpoint
ALTER TABLE "ai_agent" DROP CONSTRAINT "ai_agent_role_id_team_role_id_fk";--> statement-breakpoint
-- A team that holds an agent but no role at all gets the default one team creation
-- writes. It grants nothing until an operator edits it, which is the safe end of the
-- range for a state the application never produces.
INSERT INTO "team_role" ("team_id", "name", "is_default", "permissions")
SELECT DISTINCT a."team_id", 'Member', true, '{}'::jsonb
  FROM "ai_agent" a
 WHERE a."role_id" IS NULL
   AND NOT EXISTS (SELECT 1 FROM "team_role" r WHERE r."team_id" = a."team_id");--> statement-breakpoint
-- An empty role_id used to fall back to a permission matrix in code, a copy of the
-- default Member role taken when the team was made, which later edits of that role
-- never reached. Every agent is put on a real role of its team instead — the default
-- one, or the oldest it has — so editing that role changes what the agent may do.
UPDATE "ai_agent" a
   SET "role_id" = (
     SELECT r."id" FROM "team_role" r
      WHERE r."team_id" = a."team_id"
      ORDER BY r."is_default" DESC, r."id"
      LIMIT 1
   )
 WHERE a."role_id" IS NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" ALTER COLUMN "role_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- The bot user's project memberships carry the same role, so a permission check that
-- resolves it through project_member reads what the agent row says.
UPDATE "project_member" m
   SET "role_id" = a."role_id"
  FROM "ai_agent" a
 WHERE a."user_id" = m."user_id" AND m."role_id" IS DISTINCT FROM a."role_id";

--> statement-breakpoint
ALTER TABLE "ai_agent" DROP CONSTRAINT "ai_agent_runner_scope_check";--> statement-breakpoint
ALTER TABLE "ai_agent" ALTER COLUMN "runner_scope" SET DEFAULT 'team';--> statement-breakpoint
UPDATE "ai_agent" SET "runner_scope" = 'team' WHERE "runner_scope" = 'project';--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_runner_scope_check" CHECK ("ai_agent"."runner_scope" IN ('owner', 'team'));
--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "mcp_enabled" boolean DEFAULT true NOT NULL;

--> statement-breakpoint
-- What this migration did to the instance's data, for the screen the app shows after
-- an upgrade. Written as one row of app_setting; the temp tables above hold the parts
-- the schema no longer carries.
CREATE TEMP TABLE "rename_after" AS
SELECT 'roles' AS "kind", "id", "name" FROM "team_role"
UNION ALL SELECT 'skills', "id", "name" FROM "agent_skill"
UNION ALL SELECT 'agents', "id", "username" FROM "ai_agent"
UNION ALL SELECT 'credentials', "id", COALESCE("label", '') FROM "integration_credential";--> statement-breakpoint

INSERT INTO "app_setting" ("key", "value", "updated_at")
SELECT 'migration.0115_teams', jsonb_build_object(
  'version', 1,
  'teams', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('name', t."name", 'projects', p."projects") ORDER BY t."name")
      FROM "team" t
      CROSS JOIN LATERAL (
        SELECT COALESCE(
                 jsonb_agg(jsonb_build_object('key', pr."key", 'name', pr."name") ORDER BY pr."key"),
                 '[]'::jsonb) AS "projects"
          FROM "project" pr WHERE pr."team_id" = t."id"
      ) p
     WHERE jsonb_array_length(p."projects") > 0
  ), '[]'::jsonb),
  'renamed', (
    SELECT jsonb_object_agg(k."kind", COALESCE(x."items", '[]'::jsonb))
      FROM (VALUES ('roles'), ('skills'), ('agents'), ('credentials')) AS k("kind")
      LEFT JOIN (
        SELECT b."kind",
               jsonb_agg(jsonb_build_object('from', b."name", 'to', a."name") ORDER BY b."name") AS "items"
          FROM "rename_before" b
          JOIN "rename_after" a ON a."kind" = b."kind" AND a."id" = b."id"
         WHERE a."name" IS DISTINCT FROM b."name"
         GROUP BY b."kind"
      ) x ON x."kind" = k."kind"
  ),
  'merged', jsonb_build_object(
    'roles', COALESCE((SELECT "value" FROM "migration_count" WHERE "key" = 'mergedRoles'), 0),
    'agentTools', COALESCE((SELECT "value" FROM "migration_count" WHERE "key" = 'mergedAgentTools'), 0)
  ),
  'movedInvites', COALESCE((SELECT "value" FROM "migration_count" WHERE "key" = 'movedInvites'), 0),
  'droppedNotificationSettings', COALESCE(
    (SELECT jsonb_agg("name" ORDER BY "name") FROM "dropped_notification_setting"), '[]'::jsonb)
), now()
ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value", "updated_at" = now();--> statement-breakpoint
DROP TABLE "rename_before";--> statement-breakpoint
DROP TABLE "rename_after";--> statement-breakpoint
DROP TABLE "migration_count";--> statement-breakpoint
DROP TABLE "dropped_notification_setting";
