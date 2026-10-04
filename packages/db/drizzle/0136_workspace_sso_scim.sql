ALTER TABLE "scim_group" DROP CONSTRAINT "scim_group_display_name_unique";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "scim_workspace_id" integer;--> statement-breakpoint
-- The instance SCIM provider saw every account, so once a token was issued all of them belong to the instance workspace.
UPDATE "user" SET "scim_workspace_id" = (SELECT min("id") FROM "workspace")
WHERE ("scim_external_id" IS NOT NULL
  OR EXISTS (SELECT 1 FROM "app_secret" WHERE "key" = 'auth.scim' AND "redacted"->>'hasToken' = 'true'))
  AND NOT EXISTS (SELECT 1 FROM "ai_agent" WHERE "ai_agent"."user_id" = "user"."id");--> statement-breakpoint
ALTER TABLE "scim_group" ADD COLUMN "workspace_id" integer;--> statement-breakpoint
UPDATE "scim_group" SET "workspace_id" = (SELECT min("id") FROM "workspace");--> statement-breakpoint
ALTER TABLE "scim_group" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scim_group" ADD CONSTRAINT "scim_group_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scim_group" ADD CONSTRAINT "scim_group_workspace_id_display_name_unique" UNIQUE("workspace_id","display_name");--> statement-breakpoint
UPDATE "app_secret" SET "key" = 'workspace.' || (SELECT min("id") FROM "workspace") || '.oidc' WHERE "key" = 'auth.oidc';--> statement-breakpoint
UPDATE "app_secret" SET "key" = 'workspace.' || (SELECT min("id") FROM "workspace") || '.scim' WHERE "key" = 'auth.scim';
