ALTER TABLE "issue" ADD COLUMN "share_extended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_view" ADD COLUMN "share_extended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Links shared before the flag existed exposed the full issue, so they keep it.
UPDATE "issue" SET "share_extended" = true WHERE "share_token" IS NOT NULL;--> statement-breakpoint
UPDATE "project_view" SET "share_extended" = true WHERE "share_token" IS NOT NULL;
