ALTER TABLE "user" ADD COLUMN "active" boolean DEFAULT true;--> statement-breakpoint
-- On a self-hosted instance SCIM acts on the whole instance again: an account the instance workspace's provider deactivated cannot sign in.
UPDATE "user" u SET "active" = false
FROM "scim_user" su
WHERE su."user_id" = u."id" AND NOT su."active" AND su."workspace_id" = (SELECT min("id") FROM "workspace");
