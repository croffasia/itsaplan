ALTER TABLE "scim_user" DROP CONSTRAINT "scim_user_workspace_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "scim_group" ALTER COLUMN "workspace_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scim_user" ALTER COLUMN "workspace_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "scim_group_instance_display_name_uq" ON "scim_group" USING btree ("display_name") WHERE "scim_group"."workspace_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "scim_user_instance_user_uq" ON "scim_user" USING btree ("user_id") WHERE "scim_user"."workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "scim_user" ADD CONSTRAINT "scim_user_workspace_id_user_id_unique" UNIQUE("workspace_id","user_id");--> statement-breakpoint
-- The instance's SCIM provider is set up in god mode and belongs to no workspace. Until now it was the first workspace's.
UPDATE "scim_user" SET "workspace_id" = NULL WHERE "workspace_id" = (SELECT min("id") FROM "workspace");--> statement-breakpoint
UPDATE "scim_group" SET "workspace_id" = NULL WHERE "workspace_id" = (SELECT min("id") FROM "workspace");--> statement-breakpoint
UPDATE "app_secret" SET "key" = 'auth.scim' WHERE "key" = 'workspace.' || (SELECT min("id") FROM "workspace") || '.scim';--> statement-breakpoint
-- The first workspace held every team. Each one goes to the workspace of its first owner, and the first workspace stays its owner's.
-- An owner with no workspace gets one named after them. The first workspace's owner and admins do not follow a team out: the owner
-- of its new workspace decides who manages it. Its model prices do, so the team's agent costs read as before.
DO $$
DECLARE
  shared integer := (SELECT min("id") FROM "workspace");
  moving record;
  target integer;
BEGIN
  FOR moving IN
    SELECT DISTINCT ON (tm."team_id") tm."team_id", tm."user_id", u."name", u."email"
    FROM "team_member" tm
    JOIN "team" t ON t."id" = tm."team_id"
    JOIN "user" u ON u."id" = tm."user_id"
    WHERE t."workspace_id" = shared AND tm."role" = 'owner'
    ORDER BY tm."team_id", tm."created_at", tm."user_id"
  LOOP
    SELECT "workspace_id" INTO target FROM "workspace_manager"
    WHERE "user_id" = moving."user_id" AND "role" = 'owner'
    ORDER BY "workspace_id" LIMIT 1;
    CONTINUE WHEN target = shared;
    IF target IS NULL THEN
      INSERT INTO "workspace" ("name")
      VALUES (left(coalesce(nullif(trim(moving."name"), ''), split_part(moving."email", '@', 1)), 60))
      RETURNING "id" INTO target;
      INSERT INTO "workspace_manager" ("workspace_id", "user_id", "role")
      VALUES (target, moving."user_id", 'owner');
    END IF;
    INSERT INTO "model_price" ("workspace_id", "provider", "model", "input", "output", "cache_read", "cache_write")
    SELECT target, "provider", "model", "input", "output", "cache_read", "cache_write" FROM "model_price"
    WHERE "workspace_id" = shared
    ON CONFLICT DO NOTHING;
    UPDATE "team" SET "workspace_id" = target WHERE "id" = moving."team_id";
  END LOOP;
END $$;--> statement-breakpoint
-- On a database with no account yet the first workspace has no owner and no team.
DELETE FROM "workspace" w
WHERE NOT EXISTS (SELECT 1 FROM "workspace_manager" wm WHERE wm."workspace_id" = w."id" AND wm."role" = 'owner')
  AND NOT EXISTS (SELECT 1 FROM "team" t WHERE t."workspace_id" = w."id");
