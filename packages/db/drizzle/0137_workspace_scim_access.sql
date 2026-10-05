CREATE TABLE "scim_user" (
	"workspace_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"external_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scim_user_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "scim_user" ADD CONSTRAINT "scim_user_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scim_user" ADD CONSTRAINT "scim_user_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scim_user_user_idx" ON "scim_user" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "scim_user" ("workspace_id", "user_id", "external_id", "active")
SELECT coalesce("scim_workspace_id", (SELECT min("id") FROM "workspace")), "id", "scim_external_id", coalesce("active", true)
FROM "user"
WHERE "scim_workspace_id" IS NOT NULL OR "active" = false;--> statement-breakpoint
-- A deactivated account could not sign in at all. It can now, so it leaves the teams of the workspace that deactivated it, and a team or project left without an owner passes to the workspace owner.
INSERT INTO "team_member" ("team_id", "user_id", "role")
SELECT t."id", wm."user_id", 'owner'
FROM "team" t
JOIN "workspace_manager" wm ON wm."workspace_id" = t."workspace_id" AND wm."role" = 'owner'
WHERE EXISTS (
    SELECT 1 FROM "team_member" tm
    JOIN "scim_user" su ON su."user_id" = tm."user_id" AND su."workspace_id" = t."workspace_id" AND NOT su."active"
    WHERE tm."team_id" = t."id" AND tm."role" = 'owner')
  AND NOT EXISTS (
    SELECT 1 FROM "team_member" tm
    WHERE tm."team_id" = t."id" AND tm."role" = 'owner'
      AND NOT EXISTS (SELECT 1 FROM "scim_user" su WHERE su."user_id" = tm."user_id" AND su."workspace_id" = t."workspace_id" AND NOT su."active"))
  AND NOT EXISTS (SELECT 1 FROM "scim_user" su WHERE su."user_id" = wm."user_id" AND su."workspace_id" = t."workspace_id" AND NOT su."active")
ON CONFLICT ("team_id", "user_id") DO UPDATE SET "role" = 'owner';--> statement-breakpoint
CREATE TEMPORARY TABLE "scim_orphaned_project" AS
SELECT p."id" AS "project_id", t."id" AS "team_id", wm."user_id" AS "successor_id"
FROM "project" p
JOIN "team" t ON t."id" = p."team_id"
JOIN "workspace_manager" wm ON wm."workspace_id" = t."workspace_id" AND wm."role" = 'owner'
WHERE EXISTS (
    SELECT 1 FROM "project_member" pm
    JOIN "scim_user" su ON su."user_id" = pm."user_id" AND su."workspace_id" = t."workspace_id" AND NOT su."active"
    WHERE pm."project_id" = p."id" AND pm."role" = 'owner')
  AND NOT EXISTS (
    SELECT 1 FROM "project_member" pm
    WHERE pm."project_id" = p."id" AND pm."role" = 'owner'
      AND NOT EXISTS (SELECT 1 FROM "scim_user" su WHERE su."user_id" = pm."user_id" AND su."workspace_id" = t."workspace_id" AND NOT su."active"))
  AND NOT EXISTS (SELECT 1 FROM "scim_user" su WHERE su."user_id" = wm."user_id" AND su."workspace_id" = t."workspace_id" AND NOT su."active");--> statement-breakpoint
INSERT INTO "team_member" ("team_id", "user_id", "role")
SELECT DISTINCT "team_id", "successor_id", 'member' FROM "scim_orphaned_project"
ON CONFLICT ("team_id", "user_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "project_member" ("project_id", "user_id", "role", "role_id", "source")
SELECT "project_id", "successor_id", 'owner', NULL, 'invite' FROM "scim_orphaned_project"
ON CONFLICT ("project_id", "user_id") DO UPDATE SET "role" = 'owner', "role_id" = NULL, "source" = 'invite';--> statement-breakpoint
DROP TABLE "scim_orphaned_project";--> statement-breakpoint
UPDATE "project_column" pc SET "auto_assign_user_id" = NULL
FROM "project" p, "team" t, "scim_user" su
WHERE pc."project_id" = p."id" AND t."id" = p."team_id" AND su."workspace_id" = t."workspace_id"
  AND NOT su."active" AND pc."auto_assign_user_id" = su."user_id";--> statement-breakpoint
DELETE FROM "project_member" pm
USING "project" p, "team" t, "scim_user" su
WHERE pm."project_id" = p."id" AND t."id" = p."team_id" AND su."workspace_id" = t."workspace_id"
  AND NOT su."active" AND pm."user_id" = su."user_id";--> statement-breakpoint
DELETE FROM "team_member" tm
USING "team" t, "scim_user" su
WHERE tm."team_id" = t."id" AND su."workspace_id" = t."workspace_id"
  AND NOT su."active" AND tm."user_id" = su."user_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "active";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "scim_external_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "scim_workspace_id";--> statement-breakpoint
-- Single sign-on is set in god mode for the whole instance.
UPDATE "app_secret" SET "key" = 'auth.oidc' WHERE "key" = 'workspace.' || (SELECT min("id") FROM "workspace") || '.oidc';--> statement-breakpoint
DELETE FROM "app_secret" WHERE "key" LIKE 'workspace.%.oidc';
